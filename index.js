const express = require('express');
const assemblyai = require('assemblyai');
const multer = require('multer');
const { getFirestore, collection, getDocs,addDoc  } = require('firebase/firestore/lite');
const {initializeApp} = require('firebase/app')
const { getStorage, ref, getDownloadURL, uploadBytesResumable, uploadString } = require('firebase/storage');
const {AssemblyAI} = assemblyai;
const cors = require('cors');

const app = express();
const port = 3000; 

function secondsToHMS(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${hours}h:${minutes}m:${remainingSeconds}s`
}

function generateUniqueFilename(originalFilename) {
  const timestamp = Date.now();
  const filenameWithoutExtension = originalFilename.split('.').slice(0, -1).join('.');
  const fileExtension = originalFilename.split('.').pop();
  return `${filenameWithoutExtension}_${timestamp}.txt`;
}

const firebaseConfig = {
  apiKey: "AIzaSyBp3azDdwf-idhrAVqejd14G77IPT5ZNNo",
  authDomain: "audios-e6cef.firebaseapp.com",
  projectId: "audios-e6cef",
  storageBucket: "audios-e6cef.appspot.com",
  messagingSenderId: "1045088670392",
  appId: "1:1045088670392:web:c94977ff081c4e5a39da4d",
  measurementId: "G-S8M790QY7N"
};

const ap = initializeApp(firebaseConfig);
const storage = getStorage();
const db = getFirestore(ap);


const client = new AssemblyAI({
  apiKey: 'e67649cb8d394b419966a3045bb0808a',
});


const store = multer.memoryStorage();
const upload = multer({ storage: store });

app.use(cors({
  origin: '*'
}))

app.post('/transcribe', upload.single('audioFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const uploadedFile = req.file;
    const fileName = uploadedFile.originalname;
    const fileType = uploadedFile.mimetype;
    const dateCreated = new Date(); 
    const lastUpdated = new Date(); 
    const uniqueFileName = generateUniqueFilename(fileName);
    const enableSpeakerIdentification = req.body.enableSpeakerIdentification;
    
    const formattedDateCreated = `${dateCreated.getFullYear()}-${(dateCreated.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${dateCreated.getDate().toString().padStart(2, '0')}`;
    
    const formattedLastUpdated = `${lastUpdated.getFullYear()}-${(lastUpdated.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${lastUpdated.getDate().toString().padStart(2, '0')}`;

    const transcript = await client.transcripts.create({
      audio_url: req.file.buffer, // Use the uploaded file data
      speaker_labels: enableSpeakerIdentification,
      language_detection: true,
    });

    const duration = secondsToHMS(transcript.audio_duration)
    const utterancesList = [];

    if(transcript.utterances){
    for (const utterance of transcript.utterances) {
      utterancesList.push({
        speaker: utterance.speaker,
        text: utterance.text,
      });
    }}
     
    const textToSave = transcript.text+'\n'+utterancesList.map(utterance => `${utterance.speaker}: ${utterance.text}`).join('\n');
    const textFileRef = ref(storage, uniqueFileName);
    const snapshot = await uploadString(textFileRef, textToSave, 'raw');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('File uploaded to Firebase Storage. Download URL:', downloadURL);

    const samp = {
      fileName: fileName,
      fileType: fileType,
      dateCreated: formattedDateCreated,
      lastUpdated: formattedLastUpdated,
      downloadURL: downloadURL,
      duration,
    }
    console.log(samp)
    await addDoc(collection(db, "docs"), samp)
    res.json({
      fileName: fileName,
      fileType: fileType,
      dateCreated: dateCreated,
      lastUpdated: lastUpdated,
      downloadURL: downloadURL,
      duration,
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
