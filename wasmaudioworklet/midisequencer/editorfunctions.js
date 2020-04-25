import { getRecordedData } from '../webaudiomodules/wammanager.js';
import { RecordConverter } from './recording.js';

export async function insertMidiRecording(insertStringIntoEditor) {
    insertStringIntoEditor(new RecordConverter(await getRecordedData(), 80).trackerPatternData);
}