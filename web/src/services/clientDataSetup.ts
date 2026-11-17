import { configureClientData } from '@studyforge/client-data/clientDb';
import { db } from '../config/firebase';

// Side-effect module: every web shim over @studyforge/client-data imports this first.
configureClientData({ db });
