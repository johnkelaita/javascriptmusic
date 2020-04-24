import { resetTick, setBPM, nextTick, currentTime } from './pattern.js';
import { TrackerPattern, pitchbend, controlchange, createNoteFunctions } from './trackerpattern.js';
import { SEQ_MSG_LOOP, SEQ_MSG_START_RECORDING, SEQ_MSG_STOP_RECORDING } from './sequenceconstants.js';

let songmessages = [];
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const output = { sendMessage: (msg) => {
    songmessages.push({
        time: currentTime(),
        message: msg
    })
} };

function playFromHere() {
    songmessages = [];
    resetTick();
}

function loopHere() {
    output.sendMessage([SEQ_MSG_LOOP]);
}

function startRecording() {
    output.sendMessage([SEQ_MSG_START_RECORDING]);
}

function stopRecording() {
    output.sendMessage([SEQ_MSG_STOP_RECORDING]);
}

const songargs = {
    'output': output,
    'setBPM': setBPM,
    'TrackerPattern': TrackerPattern,
    'createTrack': (channel, stepsperbeat, defaultvelocity) =>
            new TrackerPattern(output, channel, stepsperbeat, defaultvelocity),
    'playFromHere': playFromHere,
    'loopHere': loopHere,
    'pitchbend': pitchbend,
    'controlchange': controlchange,
    'startRecording': startRecording,
    'stopRecording': stopRecording
};
Object.assign(songargs, createNoteFunctions());
const songargkeys = Object.keys(songargs);

export async function compileSong(songsource) {
    songmessages = [];

    console.log('compile song');
    resetTick();
    const songfunc = new AsyncFunction(songargkeys, songsource);
    const songpromise = songfunc.apply(
        null,
        songargkeys.map(k => songargs[k])
    );

    while (await nextTick());

    await songpromise;

    console.log('song compiled');
    return songmessages;
}