const TelegramBot = require('node-telegram-bot-api');
const { Heap } = require('heap-js'); // ✅ FIX: Use Heap instead of MinHeap

// Replace with your Telegram Bot Token
const TOKEN = '7603494053:AAHhpqQKLItdNFPoOGI-oq2ZMsDGfQ0-KrMkk';
const bot = new TelegramBot(TOKEN, { polling: true });

class Patient {
  constructor(id, name, condition, arrivalTime) {
    this.id = id;
    this.name = name;
    this.condition = condition; // 1 (critical) to 5 (non-urgent)
    this.arrivalTime = arrivalTime || Date.now();
    this.waitTime = 0;
  }
}

class PatientQueue {
  constructor() {
    const priorityComparator = (a, b) => a.condition - b.condition;
    this.emergencyQueue = new Heap(priorityComparator); // ✅ FIX: Use Heap
    this.regularQueue = new Heap(priorityComparator);   // ✅ FIX: Use Heap
    this.treatedPatients = [];
    this.currentId = 1;
  }

  addPatient(name, condition) {
    const patient = new Patient(this.currentId++, name, condition);
    if (condition <= 3) {
      this.emergencyQueue.push(patient);
    } else {
      this.regularQueue.push(patient);
    }
    return patient;
  }

  processNextPatient() {
    const now = Date.now();
    let patient;

    if (this.emergencyQueue.length > 0) { // ✅ FIX: Corrected isEmpty check
      patient = this.emergencyQueue.pop();
    } else if (this.regularQueue.length > 0) { // ✅ FIX: Corrected isEmpty check
      patient = this.regularQueue.pop();
    }

    if (patient) {
      patient.waitTime = (now - patient.arrivalTime) / 60000; // Convert ms to minutes
      this.treatedPatients.push(patient);
    }

    return patient;
  }

  getStatus() {
    return {
      emergencyCount: this.emergencyQueue.length,
      regularCount: this.regularQueue.length,
      treatedCount: this.treatedPatients.length,
      avgWaitTime: this.treatedPatients.length > 0 
        ? (this.treatedPatients.reduce((sum, p) => sum + p.waitTime, 0) / this.treatedPatients.length).toFixed(1)
        : 0
    };
  }
}

const hospitalQueue = new PatientQueue();

// Command handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    `🏥 *Hospital Queue Management Bot*\n\n` +
    `Available commands:\n` +
    `/addpatient - Register a new patient\n` +
    `/nextpatient - Process next patient\n` +
    `/status - Show current queue status\n` +
    `/help - Show help information`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/addpatient/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Please enter patient details in this format:\n\n`Name, Priority (1-5)`\n\nExample: `John Doe, 2`", {
    parse_mode: 'Markdown',
    reply_markup: { force_reply: true }
  });
});

bot.onText(/\/nextpatient/, (msg) => {
  const chatId = msg.chat.id;
  const patient = hospitalQueue.processNextPatient();

  if (patient) {
    bot.sendMessage(chatId, 
      `✅ *Patient Treated*\n\n` +
      `*Name:* ${patient.name}\n` +
      `*Priority:* ${patient.condition}\n` +
      `*Wait Time:* ${patient.waitTime.toFixed(1)} minutes`,
      { parse_mode: 'Markdown' }
    );
  } else {
    bot.sendMessage(chatId, "No patients in the queue.");
  }
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const stats = hospitalQueue.getStatus();

  bot.sendMessage(chatId, 
    `🏥 *Queue Status*\n\n` +
    `*Emergency Patients:* ${stats.emergencyCount}\n` +
    `*Regular Patients:* ${stats.regularCount}\n` +
    `*Treated Patients:* ${stats.treatedCount}\n` +
    `*Avg Wait Time:* ${stats.avgWaitTime} minutes`,
    { parse_mode: 'Markdown' }
  );
});

// Handle patient registration replies
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Check if this is a reply to the addpatient prompt
  if (msg.reply_to_message && msg.reply_to_message.text && 
      msg.reply_to_message.text.includes('Name, Priority (1-5)')) {

    const parts = text.split(',').map(part => part.trim());
    if (parts.length !== 2) {
      return bot.sendMessage(chatId, "Invalid format. Please use: `Name, Priority`", { parse_mode: 'Markdown' });
    }

    const priority = parseInt(parts[1]);
    if (isNaN(priority)) {
      return bot.sendMessage(chatId, "Priority must be a number (1-5)");
    }

    if (priority < 1 || priority > 5) {
      return bot.sendMessage(chatId, "Priority must be between 1 (critical) and 5 (non-urgent)");
    }

    const patient = hospitalQueue.addPatient(parts[0], priority);
    const queueType = priority <= 3 ? "Emergency" : "Regular";

    bot.sendMessage(chatId, 
      `🆕 *Patient Registered*\n\n` +
      `*Name:* ${patient.name}\n` +
      `*Priority:* ${patient.condition}\n` +
      `*Queue:* ${queueType}\n` +
      `*ID:* ${patient.id}`,
      { parse_mode: 'Markdown' }
    );
  }
});

console.log('Hospital Queue Bot is running...');
