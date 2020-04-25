import { getRecordedData, startWAM} from './wammanager.js';
import assert from 'assert';

describe('wammanager', async function() {
    this.beforeAll(() => {
        let scriptelement = {};
        global.document = {
            // Mock external scriptloader
            createElement: () => scriptelement,
            documentElement: { appendChild: () => scriptelement.onload()}
        };
        class YOSHIMIMock {
            constructor() {

            }
            
            static importScripts() {}

            connect() {}
            
            sendMessage() {
                
            }

            async waitForMessage() {
                return {recorded: {"16384":[[144,62,100]],"22784":[[144,62,0]],"32256":[[144,65,100]],"37120":[[144,65,0]],"49920":[[144,69,100]],"53248":[[144,69,0]]}};
            }
        }
        global.WAM = {
            YOSHIMI: YOSHIMIMock
        };
        startWAM({
            sampleRate: 44100
        });
    });
    it('should get recorded data as an array of events', async () => {
        const eventlist = await getRecordedData();
        assert.equal(eventlist.length, 6);
        const expected = [
                [ 0.37151927437641724, 144, 62, 100 ],
                [ 0.5166439909297053, 144, 62, 0 ],
                [ 0.7314285714285714, 144, 65, 100 ],
                [ 0.8417233560090703, 144, 65, 0 ],
                [ 1.1319727891156464, 144, 69, 100 ],
                [ 1.207437641723356, 144, 69, 0 ]
            ];
        eventlist.forEach((event, ndx) => assert.equal(JSON.stringify(event), JSON.stringify(expected[ndx])))
    });
});