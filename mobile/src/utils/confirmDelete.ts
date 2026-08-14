import { Alert, Platform } from 'react-native';

/**
 * The one question Poke asks before it removes a record.
 *
 * `Alert.alert` does nothing on web, so the web build asks the browser instead.
 * The History sheet and the shot edit screen both delete a shot, and a delete
 * that asks in two voices is two features to the reader, so both call this.
 *
 * `message` names the record. The title carries the question.
 */
export function confirmDelete(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Delete this entry?', message, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
