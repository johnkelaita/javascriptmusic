import assert from 'assert';
import { RecordConverter } from './recording.js';

const recorded = [
    [ 0.37151927437641724, 144, 62, 100 ],
    [ 0.5166439909297053, 144, 62, 0 ],
    [ 0.7314285714285714, 144, 65, 100 ],
    [ 0.8417233560090703, 144, 65, 0 ],
    [ 1.1319727891156464, 144, 69, 100 ],
    [ 1.207437641723356, 144, 69, 0 ]
  ];

describe('recording', function() {    
    it("should convert eventlist to list of notes with durations", () => {
        const converted = new RecordConverter(recorded, 80).notesByBeat;        
        const expected = [[ 0, 62, 100, 0.4953590325018897, 0.1934996220710507 ],
                        [ 0, 65, 100, 0.9752380952380952, 0.14705971277399854 ],
                        [ 0, 69, 100, 1.5092970521541953, 0.10061980347694632 ]];
        assert.equal(converted.length, expected.length);
        converted.forEach((note, ndx) => assert.equal(JSON.stringify(converted[ndx]), JSON.stringify(expected[ndx])));        
    });
    it("should convert eventlist to code", () => {
        const converted = new RecordConverter(recorded, 80).trackerPatternData;        
        const expected = 'createTrack(0).play([[ 0.50, d5(0.19, 100) ],\n[ 0.98, f5(0.15, 100) ],\n[ 1.51, a5(0.10, 100) ]]);\n'
        assert.equal(converted, expected);
    });
});