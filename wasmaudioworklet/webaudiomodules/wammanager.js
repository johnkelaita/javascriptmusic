import { loadScript } from '../common/scriptloader.js';

let wamstarted = false;
let previousSynthSource;
export let wamsynth;

let wamPaused;
let lastPostedSong = [];

export async function startWAM(actx) {
    wamPaused = false;
    if (!wamstarted) {    
        wamstarted = true;
        console.log('starting WAM synth');
        await loadScript("https://petersalomonsen.github.io/yoshimi/wam/dist/libs/audioworklet.js"); 
        await loadScript("https://petersalomonsen.github.io/yoshimi/wam/dist/libs/wam-controller.js");
        await loadScript("webaudiomodules/yoshimi.js");
        await WAM.YOSHIMI.importScripts(actx);
        wamsynth = new WAM.YOSHIMI(actx);
        wamsynth.connect(actx.destination);
        console.log('WAM synth started');
    }
}

export async function postSong(eventlist, synthsource) {
    lastPostedSong = eventlist;

    if (wamPaused) {
        return;
    }
    if (synthsource !== previousSynthSource) {
        previousSynthSource = synthsource;
        console.log('updating synth');
        wamsynth.sendMessage("set", "param", synthsource);
        await wamsynth.waitForMessage();
    }

    wamsynth.sendMessage("set", "seq", eventlist);    
}

export function stopWAMSong() {
    wamsynth.sendMessage("set", "seq", []);
    for (let channel = 0; channel < 16; channel++) {
        wamsynth.onMidi([0xb0 + channel, 123, 0]);
    }
}

export function pauseWAMSong() {
    if (wamsynth) {
        stopWAMSong();
        wamPaused = true;
    }
}

export function resumeWAMSong() {
    wamsynth.sendMessage("set", "seq", lastPostedSong);
}

export async function getRecordedData() {
    wamsynth.sendMessage("get", "recorded");
    return (await wamsynth.waitForMessage()).recorded;
}

export function onMidi(msg) {
    if (wamsynth) {
        wamsynth.onMidi(msg);
    }
}