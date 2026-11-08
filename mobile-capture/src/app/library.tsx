import { Redirect } from 'expo-router';

export default function LibraryRoute() {
  return <Redirect href={{ pathname: '/', params: { view: 'library' } }} />;
}
