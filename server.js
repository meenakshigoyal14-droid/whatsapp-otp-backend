const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors()); // Hostinger website se call allow karne ke liye
app.use(bodyParser.json());

const otpStore = {};

// 1. Home page - check karne ke liye ki server chal raha hai
app.get('/', (req, res) => {
  res.send('SearchMyHostels OTP Backend is Running!');
});

// 2. META WEBHOOK VERIFY KAREGA
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('WEBHOOK VERIFIED!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

// 3. OTP SEND API
app.post('/api/send-otp', async (req, res) => {
  const { phone } = req.body;
  if(!phone) return res.status(400).json({success: false, message: "Phone number chahiye"});

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000 };
  console.log(`OTP for ${phone} is ${otp}`);

  try {
    await axios.post(`https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: "otp_login", // <-- Meta me aapke template ka naam
        language: { code: "en_US" },
        components: [{ type: "body", parameters: [{ type: "text", text: otp }] }]
      }
    }, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
    
    res.json({ success: true, message: "OTP bhej diya" });
  } catch (e) {
    console.log(e.response?.data || e.message);
    res.status(500).json({ success: false, error: e.response?.data });
  }
});

// 4. OTP VERIFY API
app.post('/api/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore[phone];
  if (!record) return res.json({ success: false, message: "OTP expire ho gaya" });
  if (Date.now() > record.expires) return res.json({ success: false, message: "OTP expire ho gaya" });
  if (record.otp == otp) {
    delete otpStore[phone];
    return res.json({ success: true, message: "Verified!" });
  }
  res.json({ success: false, message: "Galat OTP" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));