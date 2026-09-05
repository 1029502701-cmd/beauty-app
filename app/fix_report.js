var fs = require('fs');
var p = 'src/pages/ReportPage.jsx';
var c = fs.readFileSync(p, 'utf8');

// 1. Add import
var old1 = "import { removeStorageItem, STORAGE_KEYS } from '../utils/storage.js';";
var new1 = old1 + "\nimport CapturePhotoUpload from './CapturePhotoUpload.jsx';";
c = c.replace(old1, new1);

// 2. Add state after tier3TimerRef
var old2 = "  const tier3TimerRef = useRef(null);";
var new2 = old2 + "\n\n  // 今日报告 & 档案 state\n  const [todayReport, setTodayReport] = useState(null);\n  const [todayLoading, setTodayLoading] = useState(false);\n  const [showArchive, setShowArchive] = useState(false);\n  const [archiveReports, setArchiveReports] = useState([]);\n  const [archiveLoading, setArchiveLoading] = useState(false);";
c = c.replace(old2, new2);

fs.writeFileSync(p, c, 'utf8');
console.log('step1 done');
