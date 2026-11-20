import { useLocalSearchParams } from 'expo-router';
import { SearchScreen } from '../../../features/library/SearchScreen';

export default function SearchRoute() {
  const { directoryId } = useLocalSearchParams<{ directoryId?: string }>();
  return <SearchScreen directoryId={directoryId || undefined} />;
}
