import { loadScript, loadCSS } from './common/scriptloader.js';
import { compileSong as compileMidiSong } from './midisequencer/songcompiler.js';
import { postSong as wamPostSong} from './webaudiomodules/wammanager.js';

async function loadCodeMirror() {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.52.2/codemirror.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.52.2/mode/javascript/javascript.js'); 
    
    await loadScript('https://codemirror.net/addon/search/search.js');
    await loadScript('https://codemirror.net/addon/search/searchcursor.js');
    await loadScript('https://codemirror.net/addon/search/jump-to-line.js');
    await loadScript('https://codemirror.net/addon/dialog/dialog.js');
    
    await loadScript('https://unpkg.com/jshint@2.9.6/dist/jshint.js');
    await loadScript('https://codemirror.net/addon/lint/lint.js');
    await loadScript('https://codemirror.net/addon/lint/javascript-lint.js'); 
    await loadCSS('https://codemirror.net/addon/lint/lint.css');   
}

let webassemblySynthUpdated = false;
const synthcompilerworker = new Worker('synth1/browsercompilerwebworker.js');

async function compileWebAssemblySynth(synthsource, song, samplerate) {
    synthcompilerworker.postMessage({
        synthsource: synthsource,
        samplerate: samplerate,
        song: song
    });
    
    const result = await new Promise((resolve) => synthcompilerworker.onmessage = (msg) => resolve(msg));

    if(result.data.error) {
        throw new Error(result.data.error);
    } else if(result.data.binary) {
        console.log('successfully compiled webassembly synth');
        window.WASM_SYNTH_BYTES = result.data.binary;
        webassemblySynthUpdated = true;
    } else if(result.data.downloadWASMurl) {
        const linkElement = document.createElement('a');
        linkElement.href = result.data.downloadWASMurl;
        linkElement.download = 'song.wasm';
        linkElement.click();
    } else {
        console.log('no changes for webassembly synth');
    }
}

export async function initEditor(componentRoot) {
    await loadCodeMirror();

    const editor = CodeMirror(componentRoot.getElementById("editor"), {
        value: "",
        mode:  "javascript",
        theme: "monokai",
        lineNumbers: true,
        gutters: ["CodeMirror-lint-markers"],
        lint: {
            'esversion': '8',
            'elision': true,
            'laxcomma': true
        }
    });

    const assemblyscripteditor = CodeMirror(componentRoot.getElementById("assemblyscripteditor"), {
        value: "",
        mode: "text/typescript",
        theme: "monokai",
        lineNumbers: true,
        gutters: ["CodeMirror-lint-markers"]
    });

    const global = window;
    let pattern_tools_src;
    let synthsource;

    componentRoot.getElementById('savesongbutton').onclick = () => compileAndPostSong();

    window.compileSong = async function(exportwasm=false) {
        const errorMessagesElement = componentRoot.querySelector('#errormessages');
        const errorMessagesContentElement = errorMessagesElement.querySelector('span');
        errorMessagesContentElement.innerText = '';
        errorMessagesElement.style.display = 'none';

        const songsource = editor.doc.getValue();

        localStorage.setItem('storedsongcode', songsource);
        
        const newsynthsource = assemblyscripteditor.doc.getValue();
        if (newsynthsource !== synthsource) {
            synthsource = newsynthsource;
            localStorage.setItem('storedsynthcode', synthsource);
        }

        let songmode = 'WASM';
        if (songsource.indexOf('SONGMODE=PROTRACKER') >= 0) {
            // special mode: we are building an amiga protracker module
            songmode = 'protracker';
        } else if (songsource.indexOf('SONGMODE=YOSHIMI') >= 0) {
            // special mode: yoshimi midi synth
            songmode = 'yoshimi';
            try {                
                return { eventlist: await compileMidiSong(songsource), synthsource: synthsource };
            } catch(e) {
                errorMessagesContentElement.innerText = e;
                errorMessagesElement.style.display = 'block';
                throw e;
            }
        }

        
        eval(pattern_tools_src);
        try {
            window.WASM_SYNTH_LOCATION = null;
            if (songmode === 'WASM') {
                eval(songsource);
            }
        } catch(e) {
            errorMessagesContentElement.innerText = e;
            errorMessagesElement.style.display = 'block';
            throw e;
        }
        const patterns = generatePatterns();
        const instrumentPatternLists = generateInstrumentPatternLists();
        const song = {
                instrumentPatternLists: instrumentPatternLists,
                patterns: patterns, BPM: window.bpm,
                patternsize: 1 << window.pattern_size_shift
        };

        const spinner = componentRoot.querySelector('.spinner');
        try {
            if (!window.WASM_SYNTH_LOCATION) {
                // if not a precompiled wasm file available in WASM_SYNTH_LOCATION              
                spinner.style.display = 'block';
                await compileWebAssemblySynth(synthsource,
                        exportwasm && songmode === 'WASM' ? song: undefined,
                        songmode === 'protracker' ? 55856:
                        new AudioContext().sampleRate                        
                    );                
            }
        } catch(e) {
            errorMessagesContentElement.innerText = e;
            errorMessagesElement.style.display = 'block';
            throw e;
        }
        spinner.style.display = 'none';
        console.log('song mode', songmode);

        if (songmode === 'protracker') {
            const songworker = new Worker(
                URL.createObjectURL(new Blob([
                    songsource.split("from './lib/").join(`from '${location.origin}${location.pathname === '/' ? '' : location.pathname}/synth1/modformat/lib/`)
                ],{type: "application/javascript"})), {type: "module"}
            );
            const modreciever = new Promise((resolve => songworker.onmessage = msg => resolve(
                    msg.data
                )
            ));
            songworker.postMessage({WASM_SYNTH_BYTES: WASM_SYNTH_BYTES});
            
            const song = await modreciever;
            if(exportwasm) {
                const linkElement = document.createElement('a');
                linkElement.href = URL.createObjectURL(new Blob([song.modbytes]), 'application/octet-stream');
                linkElement.download = `${song.name.replace(/[^A-Za-z0-9]+/g,'_').toLowerCase()}.mod`;
                linkElement.click();
            }
            return song;
        }

        // Use as recording buffer
        window.recordedSongData = {
            instrumentPatternLists: song.instrumentPatternLists.map(pl => new Array(pl.length).fill(0)),
            patterns: song.patterns.map(p => new Array(p.length).fill(0))
        };    
        
        const instrSelect = componentRoot.getElementById('midichannelmappingselection');
        let instrSelectCount = 0;
        instrumentNames.forEach((name,ndx) => {            
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;            
            window.midichannelmappings[name] = ndx;
            if(instrSelect.childNodes.length <= ndx) {
                instrSelect.appendChild(opt);
            } else if(instrSelect.childNodes[ndx].value !== name) {
                instrSelect.replaceChild(opt, instrSelect.childNodes[ndx]);
            }
            instrSelectCount++;
        });
        
        Object.keys(instrumentGroupMap).forEach(groupname => {            
            const groupinstruments = instrumentGroupMap[groupname];
            window.midichannelmappings[groupname] = {
                min: window.midichannelmappings[groupinstruments[0]],
                max: window.midichannelmappings[groupinstruments[groupinstruments.length - 1]]
            };
            
            const opt = document.createElement('option');
            opt.value = groupname;
            opt.innerText = groupname;
            if(instrSelect.childNodes.length <= instrSelectCount) {
                instrSelect.appendChild(opt);
            } else if(instrSelect.childNodes[instrSelectCount].value !== groupname) {
                instrSelect.replaceChild(opt, instrSelect.childNodes[instrSelectCount]);
            }
            instrSelectCount++;
        });

        for(let n=instrSelectCount; n < instrSelect.childNodes.length; n++) {
            instrSelect.removeChild(instrSelect.childNodes[n]);
        }
        return song;
    }

    async function compileAndPostSong() {
        try {
            const song = await compileSong();
            
            if (song.eventlist) {
                await wamPostSong(song.eventlist, song.synthsource);
            } else if(window.audioworkletnode) {
                audioworkletnode.port.postMessage({
                    song: song,
                    samplerate: window.audioworkletnode.context.sampleRate, 
                    toggleSongPlay: componentRoot.getElementById('toggleSongPlayCheckbox').checked ? true: false,
                    livewasmreplace: webassemblySynthUpdated,
                    wasm: webassemblySynthUpdated ? window.WASM_SYNTH_BYTES : undefined
                });
                webassemblySynthUpdated = false;
            }
        } catch(e) {
            console.error(e);
        }
    }

    let storedsongcode = localStorage.getItem('storedsongcode');
    let storedsynthcode = localStorage.getItem('storedsynthcode');
        
    const gistparam = location.search ? location.search.substring(1).split('&').find(param => param.indexOf('gist=') === 0) : null;

    if(gistparam) {
        const gistid = gistparam.split('=')[1];
        
        const gist = await fetch(`https://api.github.com/gists/${gistid}`).then(r => r.json());
        const songfilename = Object.keys(gist.files).find(filename => filename.endsWith('.js'));
        storedsongcode = gist.files[songfilename].content;

        const synthfilename = Object.keys(gist.files).find(filename =>
                        filename.endsWith('.ts') ||
                        filename.endsWith('.xml'));
        if(synthfilename) {
            console.log(`found synth code in ${synthfilename}`);
            storedsynthcode = gist.files[synthfilename].content;
        }

        console.log(`loaded from gist ${gistid}: ${songfilename}`);
    }

    if(storedsongcode) {
        editor.doc.setValue(storedsongcode);
    } else {
        editor.doc.setValue(await fetch('emptysong.js').then(r => r.text()));
    }

    if(storedsynthcode) {
        assemblyscripteditor.doc.setValue(storedsynthcode);
    } else {
        assemblyscripteditor.doc.setValue(await fetch('synth1/assembly/mixes/empty.mix.ts').then(r => r.text()));
    }
    CodeMirror.commands.save = compileAndPostSong;
    
    const insertStringIntoEditor = (str) => {

        const selection = editor.getSelection();

        if(selection.length>0){
            editor.replaceSelection(str);
        }
        else{

            const doc = editor.doc;
            const cursor = doc.getCursor();

            const pos = {
            line: cursor.line,
            ch: cursor.ch
            }

            doc.replaceRange(str, pos);
        }
    }

    window.insertRecording = () => {
        const recorded = window.recordedSongData;
        
        const recordings = {};
        
        // find first song position with recorded data
        const firstSongPositionWithData = recorded.instrumentPatternLists
            .map(patternIndexList =>
                    patternIndexList.findIndex(patternIndex => patternIndex > 0))
            .filter(songPosition => songPosition > -1)
            .sort()[0];
        
        // find last song position with recorded data
        const lastSongPositionWithData = recorded.instrumentPatternLists
            .map(patternIndexList =>
                patternIndexList.reduce(
                    // using reduce to find last element with value > 0
                    (currentSongPosition, patternIndex, songPosition) =>
                        patternIndex > 0 ? songPosition : currentSongPosition,
                    -1
                )
            )
            .filter(songPosition => songPosition > -1)
            .sort((a, b) => b - a)[0];

        recorded.instrumentPatternLists.forEach((instrumentPatternList, instrumentIndex) => {            
            if(instrumentPatternList.find(patternIndex => patternIndex > 0)) {
                // go through pattern list for each instrument that has recorded data:
                instrumentPatternList.forEach((patternIndex, songPosition) => {                                        
                    if(!recordings[instrumentNames[instrumentIndex]]) {
                        recordings[instrumentNames[instrumentIndex]] = [];
                    }

                    if( songPosition >= firstSongPositionWithData &&
                        songPosition <= lastSongPositionWithData 
                        ) {
                        // start with an empty pattern
                        let patternData = new Array(recorded.patterns[0].length).fill(0);

                        if (patternIndex > 0 ) {
                            // get data from recorded pattern ( if there is one )
                            patternData = recorded.patterns[patternIndex-1];
                        }
                        
                        patternData.forEach(val =>
                            // push each note from recorded pattern to recordings array per instrument
                            recordings[instrumentNames[instrumentIndex]].push(val)
                        );                        
                    }
                })
            }
        });
        
        const groupRecordings = {};
        Object.keys(recordings).forEach(instrumentName => {
            let patterndata = recordings[instrumentName];

            patterndata = patterndata.map((v, ndx) => {
                if(v > 0) {
                    if(instrumentDefs[instrumentName].type === 'number') {
                        return v + '';
                    } else if(instrumentDefs[instrumentName].type === 'note') {
                        let noteLen = 1;
                        while(patterndata[ndx + noteLen] === 1 &&
                            (ndx + noteLen) < patterndata.length
                            ) {
                            // Detect how long the note is held
                            noteLen ++;
                        }
                        const beatLength = global.ticksperbeat();
                        let divisor = beatLength;
                        while ( (noteLen %2) === 0 && (divisor % 2) === 0) {
                            noteLen /= 2;
                            divisor /= 2;
                        }

                        const lengthExpression = noteLen === 1 && divisor === beatLength ? '' :
                            divisor === 1 ? `(${noteLen})` : `(${noteLen}/${divisor})`;

                        return v > 1 ? `${window.noteValues[v]}${lengthExpression}` : '';
                    }
                } else {
                    return '';
                }
            });
            
            let groupInstrumentIndex;
            const groupName = Object.keys(instrumentGroupMap).find(groupname => {
                groupInstrumentIndex = instrumentGroupMap[groupname].findIndex(instr => instr === instrumentName);
                return groupInstrumentIndex > -1;
            }); 
            
            if(groupName) {
                if(!groupRecordings[groupName]) {
                    groupRecordings[groupName] = new Array(instrumentGroupMap[groupName].length);
                }    
                groupRecordings[groupName][groupInstrumentIndex] = patterndata;
            } else {
                const stepsPerBeat = ticksperbeat();
                const recordingString = `"${instrumentName}": pp(${stepsPerBeat}, [${
                        patterndata
                            .map((val, ndx) => ndx > 0 && ndx % stepsPerBeat === 0 ? `\n${val}` : val)
                            .join(',')
                }]),\n`;            
                insertStringIntoEditor(recordingString);
            }            
        });
        Object.keys(groupRecordings).forEach(group => {
            const recordings = groupRecordings[group];
            const recordingArr = [];
            recordings.forEach((recording, instrIndex) => {
                recording.forEach((val, ndx) => {
                    if(!recordingArr[ndx]) {
                        recordingArr[ndx] = [];
                    }
                    recordingArr[ndx][instrIndex] = val;
                });
            });
            const stepsPerBeat = ticksperbeat();
            const recordingdatastring = recordingArr.map((values, ndx) => {
                    let newLine = '';
                    if(ndx > 0 && ndx % stepsPerBeat === 0) {
                        newLine = '\n';
                    }
                    if(values.filter(val => val ? true: false).length === 0) {
                        return `${newLine}`;
                    } else if(values[0] && values.filter(val => val ? true: false).length === 1) {
                        return `${newLine}${values[0]}`;
                    } else {
                        return `${newLine}[${values.join(',')}]`;
                    }
                }).join(',');
            
            const recordingString = `"${group}": pp(${stepsPerBeat}, [${recordingdatastring}], ${recordings.length}),\n`;
            insertStringIntoEditor(recordingString);
        });

        // Clear recordings
        window.recordedSongData = {
            instrumentPatternLists: recorded.instrumentPatternLists.map(pl => new Array(pl.length).fill(0)),
            patterns: recorded.patterns.map(p => new Array(p.length).fill(0))
        };    
    };
    window.editoractive = true;

    pattern_tools_src = await fetch('pattern_tools.js').then(r => r.text());
}