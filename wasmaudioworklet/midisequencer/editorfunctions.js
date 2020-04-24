import { getRecordedData } from '../webaudiomodules/wammanager.js';

export async function insertMidiRecording(insertStringIntoEditor) {
    insertStringIntoEditor(JSON.stringify(await getRecordedData()));
}