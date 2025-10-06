const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Helper = require('./models/Helper');
const Ticket = require('./models/Ticket');
const Config = require('./models/Config');

const DATA_FILE = path.join(__dirname, 'data.json');
let usingMongoDB = false;

async function connectDB() {
    const mongoURI = process.env.MONGO_URI;
    
    if (mongoURI) {
        try {
            await mongoose.connect(mongoURI);
            console.log('✅ Using MongoDB');
            usingMongoDB = true;
            await migrateFromJSON();
        } catch (error) {
            console.error('❌ MongoDB connection failed, falling back to data.json:', error.message);
            usingMongoDB = false;
        }
    } else {
        console.log('⚙️ Using local data.json fallback');
        usingMongoDB = false;
    }
}

async function migrateFromJSON() {
    if (!fs.existsSync(DATA_FILE)) return;
    
    try {
        const configCount = await Config.countDocuments();
        if (configCount > 0) return;
        
        const jsonData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        
        if (jsonData.helperPoints) {
            for (const [userId, points] of Object.entries(jsonData.helperPoints)) {
                await Helper.findOneAndUpdate(
                    { userId },
                    { points },
                    { upsert: true, new: true }
                );
            }
        }
        
        if (jsonData.activeTickets) {
            for (const [channelId, ticket] of Object.entries(jsonData.activeTickets)) {
                await Ticket.findOneAndUpdate(
                    { channelId },
                    { ...ticket, channelId },
                    { upsert: true, new: true }
                );
            }
        }
        
        await Config.findOneAndUpdate(
            { key: 'ticketCounter' },
            { value: jsonData.ticketCounter || 0 },
            { upsert: true, new: true }
        );
        
        await Config.findOneAndUpdate(
            { key: 'categoryPoints' },
            { value: jsonData.categoryPoints || {} },
            { upsert: true, new: true }
        );
        
        await Config.findOneAndUpdate(
            { key: 'ticketChannels' },
            { value: jsonData.ticketChannels || {} },
            { upsert: true, new: true }
        );
        
        await Config.findOneAndUpdate(
            { key: 'logsChannel' },
            { value: jsonData.logsChannel || null },
            { upsert: true, new: true }
        );
        
        await Config.findOneAndUpdate(
            { key: 'allowedCompletionRoles' },
            { value: jsonData.allowedCompletionRoles || [] },
            { upsert: true, new: true }
        );
        
        await Config.findOneAndUpdate(
            { key: 'allowedCreationRoles' },
            { value: jsonData.allowedCreationRoles || [] },
            { upsert: true, new: true }
        );
        
        console.log('✅ Migrated data from data.json to MongoDB');
    } catch (error) {
        console.error('Error migrating data:', error);
    }
}

async function getData() {
    if (usingMongoDB) {
        try {
            const helpers = await Helper.find({});
            const helperPoints = {};
            helpers.forEach(helper => {
                helperPoints[helper.userId] = helper.points;
            });
            
            const tickets = await Ticket.find({ status: 'active' });
            const activeTickets = {};
            tickets.forEach(ticket => {
                activeTickets[ticket.channelId] = {
                    ticketNumber: ticket.ticketNumber,
                    userId: ticket.userId,
                    category: ticket.category,
                    fields: ticket.fields,
                    selectedHelpers: ticket.selectedHelpers,
                    completedBy: ticket.completedBy
                };
            });
            
            const ticketCounter = await Config.findOne({ key: 'ticketCounter' });
            const categoryPoints = await Config.findOne({ key: 'categoryPoints' });
            const ticketChannels = await Config.findOne({ key: 'ticketChannels' });
            const logsChannel = await Config.findOne({ key: 'logsChannel' });
            const allowedCompletionRoles = await Config.findOne({ key: 'allowedCompletionRoles' });
            const allowedCreationRoles = await Config.findOne({ key: 'allowedCreationRoles' });
            
            return {
                helperPoints,
                activeTickets,
                ticketCounter: ticketCounter ? ticketCounter.value : 0,
                categoryPoints: categoryPoints ? categoryPoints.value : {
                    "Ultra Weeklies": 1,
                    "Ultra Speaker": 1,
                    "Temple Shrine": 1,
                    "Ultra Dailies": 1,
                    "Spamming": 1,
                    "Others": 1
                },
                ticketChannels: ticketChannels ? ticketChannels.value : {},
                logsChannel: logsChannel ? logsChannel.value : null,
                allowedCompletionRoles: allowedCompletionRoles ? allowedCompletionRoles.value : [],
                allowedCreationRoles: allowedCreationRoles ? allowedCreationRoles.value : []
            };
        } catch (error) {
            console.error('Error getting data from MongoDB:', error);
            return getDefaultData();
        }
    } else {
        if (!fs.existsSync(DATA_FILE)) {
            const defaultData = getDefaultData();
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        if (!data.categoryPoints) {
            data.categoryPoints = {
                "Ultra Weeklies": 1,
                "Ultra Speaker": 1,
                "Temple Shrine": 1,
                "Ultra Dailies": 1,
                "Spamming": 1,
                "Others": 1
            };
        }
        if (!data.ticketChannels) data.ticketChannels = {};
        if (!data.logsChannel) data.logsChannel = null;
        if (!data.allowedCompletionRoles) data.allowedCompletionRoles = [];
        if (!data.allowedCreationRoles) data.allowedCreationRoles = [];
        return data;
    }
}

async function saveData(data) {
    if (usingMongoDB) {
        try {
            for (const [userId, points] of Object.entries(data.helperPoints)) {
                await Helper.findOneAndUpdate(
                    { userId },
                    { points },
                    { upsert: true, new: true }
                );
            }
            
            const existingHelpers = await Helper.find({});
            for (const helper of existingHelpers) {
                if (!data.helperPoints[helper.userId]) {
                    await Helper.deleteOne({ userId: helper.userId });
                }
            }
            
            for (const [channelId, ticket] of Object.entries(data.activeTickets)) {
                await Ticket.findOneAndUpdate(
                    { channelId },
                    { ...ticket, channelId, status: 'active' },
                    { upsert: true, new: true }
                );
            }
            
            const existingTickets = await Ticket.find({ status: 'active' });
            for (const ticket of existingTickets) {
                if (!data.activeTickets[ticket.channelId]) {
                    await Ticket.updateOne(
                        { channelId: ticket.channelId },
                        { status: 'closed' }
                    );
                }
            }
            
            await Config.findOneAndUpdate(
                { key: 'ticketCounter' },
                { value: data.ticketCounter },
                { upsert: true, new: true }
            );
            
            await Config.findOneAndUpdate(
                { key: 'categoryPoints' },
                { value: data.categoryPoints },
                { upsert: true, new: true }
            );
            
            await Config.findOneAndUpdate(
                { key: 'ticketChannels' },
                { value: data.ticketChannels },
                { upsert: true, new: true }
            );
            
            await Config.findOneAndUpdate(
                { key: 'logsChannel' },
                { value: data.logsChannel },
                { upsert: true, new: true }
            );
            
            await Config.findOneAndUpdate(
                { key: 'allowedCompletionRoles' },
                { value: data.allowedCompletionRoles },
                { upsert: true, new: true }
            );
            
            await Config.findOneAndUpdate(
                { key: 'allowedCreationRoles' },
                { value: data.allowedCreationRoles },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error saving data to MongoDB:', error);
        }
    } else {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
}

function getDefaultData() {
    return {
        helperPoints: {},
        activeTickets: {},
        ticketCounter: 0,
        categoryPoints: {
            "Ultra Weeklies": 1,
            "Ultra Speaker": 1,
            "Temple Shrine": 1,
            "Ultra Dailies": 1,
            "Spamming": 1,
            "Others": 1
        },
        ticketChannels: {},
        logsChannel: null,
        allowedCompletionRoles: [],
        allowedCreationRoles: []
    };
}

module.exports = {
    connectDB,
    getData,
    saveData
};
