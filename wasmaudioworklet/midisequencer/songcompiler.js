import { resetTick, waitForFixedStartTime, setBPM, nextTick, currentTime } from './pattern.js';
import { TrackerPattern, pitchbend, controlchange, createNoteFunctions } from './trackerpattern.js';

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
    output.sendMessage([-1]);
}

const songargs = {
    'output': output,
    'setBPM': setBPM,
    'TrackerPattern': TrackerPattern,
    'createTrack': (channel, stepsperbeat, defaultvelocity) =>
            new TrackerPattern(output, channel, stepsperbeat, defaultvelocity),
    'playFromHere': playFromHere,
    'loopHere': loopHere
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