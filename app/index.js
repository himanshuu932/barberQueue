// app/index.js
import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to one of the tab screens.
  return <Redirect href="/(tabs)/menu" />;
}
