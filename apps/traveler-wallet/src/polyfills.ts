// Required for @didcid/keymaster in the browser (matches ~/archon/apps/react-wallet).
import { Buffer } from 'buffer';

(window as any).Buffer = (window as any).Buffer || Buffer;
