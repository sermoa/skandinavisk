const express = require('express');
const app = express();
const cleanse = require("sanitize-filename");
app.set('view engine', 'pug');
app.set('views', './views');
app.use(express.static(__dirname + '/public'));

const { TranslationServiceClient } = require('@google-cloud/translate');
const { text } = require('express');
const translationClient = new TranslationServiceClient();

const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const textToSpeechClient = new textToSpeech.TextToSpeechClient();
const { pipeline } = require('stream');

const projectId = 'sjov-oversaetter-1531150037182';
const location = 'global';

app.get('/', async (req, res) => {
  var text = '';
  var da, no, sv = '';

  var direction = 1;
  if (req.query.d && req.query.d == 'Back-translate') direction = 2;

  if (req.query.q) text = req.query.q;
  if (text !== '') {
    if (direction == 1) {
      da = await translateText(text, 'en-GB', 'da-DK');
      no = await translateText(text, 'en-GB', 'nb-NO');
      sv = await translateText(text, 'en-GB', 'sv-SE');
    } else {
      da = await translateText(text, 'da-DK', 'en-GB');
      no = await translateText(text, 'nb-NO', 'en-GB');
      sv = await translateText(text, 'sv-SE', 'en-GB');
    }
  }

  var title = 'Skandinavisk';
  if (text !== '') title += ' - ' + truncate(text, 25);

  res.render('home', {
    title: title,
    text: text,
    da: da,
    no: no,
    sv: sv,
    direction: direction,
  });
});

app.get('/speak/:lang/:text.mp3', async (req, res) => {
  var file = await speechToText(req.params.text, req.params.lang);
  var stat = fs.statSync(file);
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': stat.size
  });
  var readStream = fs.createReadStream(file);
  pipeline(readStream, res, () => { });
});

function truncate(str, n) {
  return (str.length > n) ? str.substr(0, n - 1) + '...' : str;
};

async function translateText(text, source, target) {
  const request = {
    parent: `projects/${projectId}/locations/${location}`,
    contents: [text],
    mimeType: 'text/plain',
    sourceLanguageCode: source,
    targetLanguageCode: target,
  };

  const [response] = await translationClient.translateText(request);
  return response.translations[0].translatedText;
}

async function speechToText(text, language) {
  const dir = `/tmp/audio/${language}`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileName = `${dir}/${cleanse(text)}.mp3`;

  if (!fs.existsSync(fileName)) {
    const request = {
      input: { text: text },
      voice: { languageCode: language, ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await textToSpeechClient.synthesizeSpeech(request);
    const writeFile = util.promisify(fs.writeFile);
    await writeFile(fileName, response.audioContent, 'binary');
  }

  return fileName;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
