const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Helper = require("./models/Helper");
const Ticket = require("./models/Ticket");
const Config = require("./models/Config");

const DATA_FILE = path.join(__dirname, "data.json");
let usingMongoDB = false;

async function connectDB() {
    const mongoURI = process.env.MONGO_URI;
    
    if (mongoURI) {
        try {
            await mongoose.connect(mongoURI);
            usingMongoDB = true;
            console.log("✅ Using MongoDB");
            return true;
        } catch (error) {
            console.error("❌ MongoDB connection failed, falling back to data.json:", error.message);
            usingMongoDB = false;
            return false;
        }
    } else {
        console.log("⚙️ Using local data.json fallback");
        usingMongoDB = false;
        return false;
    }
}

async function getData() {
    if (usingMongoDB) {
        try {
            const helpers = await Helper.find({});
            const tickets = await Ticket.find({});
            const configs = await Config.find({});

            const helperPoints = {};
            helpers.forEach(helper => {
                helperPoints[helper.userId] = helper.points;
            });

            const activeTickets = {};
            tickets.forEach(ticket => {
                activeTickets[ticket.channelId] = {
                    ticketNumber: ticket.ticketNumber,
                    userId: ticket.userId,
                    category: ticket.category,
                    fields: ticket.fields,
                    selectedHelpers: ticket.selectedHelpers,
                    completedBy: ticket.completedBy,
                    status: ticket.status,
                };
            });

            const configMap = {};
            configs.forEach(config => {
                configMap[config.key] = config.value;
            });

            const defaultData = {
                helperPoints,
                activeTickets,
                ticketCounter: configMap.ticketCounter || 0,
                categoryPoints: configMap.categoryPoints || {
                    "Ultra Weeklies": 1,
                    "Ultra Speaker": 1,
                    "Temple Shrine": 1,
                    "Ultra Dailies": 1,
                    Spamming: 1,
                    Others: 1,
                },
                ticketChannels: configMap.ticketChannels || {},
                logsChannel: configMap.logsChannel || null,
                allowedCompletionRoles: configMap.allowedCompletionRoles || [],
                allowedCreationRoles: configMap.allowedCreationRoles || [],
            };

            return defaultData;
        } catch (error) {
            console.error("Error getting data from MongoDB:", error);
            throw error;
        }
    } else {
        if (!fs.existsSync(DATA_FILE)) {
            const defaultData = {
                helperPoints: {},
                activeTickets: {},
                ticketCounter: 0,
                categoryPoints: {
                    "Ultra Weeklies": 1,
                    "Ultra Speaker": 1,
                    "Temple Shrine": 1,
                    "Ultra Dailies": 1,
                    Spamming: 1,
                    Others: 1,
                },
                ticketChannels: {},
                logsChannel: null,
                allowedCompletionRoles: [],
                allowedCreationRoles: [],
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
        if (!data.categoryPoints) {
            data.categoryPoints = {
                "Ultra Weeklies": 1,
                "Ultra Speaker": 1,
                "Temple Shrine": 1,
                "Ultra Dailies": 1,
                Spamming: 1,
                Others: 1,
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
            const helperUpdates = Object.entries(data.helperPoints).map(([userId, points]) =>
                Helper.findOneAndUpdate(
                    { userId },
                    { userId, points },
                    { upsert: true, new: true }
                )
            );
            await Promise.all(helperUpdates);

            const existingTicketChannels = await Ticket.find({}).distinct('channelId');
            const currentTicketChannels = Object.keys(data.activeTickets);
            
            const ticketsToDelete = existingTicketChannels.filter(
                channelId => !currentTicketChannels.includes(channelId)
            );
            if (ticketsToDelete.length > 0) {
                await Ticket.deleteMany({ channelId: { $in: ticketsToDelete } });
            }

            const ticketUpdates = Object.entries(data.activeTickets).map(([channelId, ticket]) =>
                Ticket.findOneAndUpdate(
                    { channelId },
                    {
                        channelId,
                        ticketNumber: ticket.ticketNumber,
                        userId: ticket.userId,
                        category: ticket.category,
                        fields: ticket.fields || [],
                        selectedHelpers: ticket.selectedHelpers || [],
                        completedBy: ticket.completedBy || null,
                        status: ticket.status || "open",
                    },
                    { upsert: true, new: true }
                )
            );
            await Promise.all(ticketUpdates);

            const configUpdates = [
                Config.findOneAndUpdate(
                    { key: "ticketCounter" },
                    { key: "ticketCounter", value: data.ticketCounter },
                    { upsert: true, new: true }
                ),
                Config.findOneAndUpdate(
                    { key: "categoryPoints" },
                    { key: "categoryPoints", value: data.categoryPoints },
                    { upsert: true, new: true }
                ),
                Config.findOneAndUpdate(
                    { key: "ticketChannels" },
                    { key: "ticketChannels", value: data.ticketChannels },
                    { upsert: true, new: true }
                ),
                Config.findOneAndUpdate(
                    { key: "logsChannel" },
                    { key: "logsChannel", value: data.logsChannel },
                    { upsert: true, new: true }
                ),
                Config.findOneAndUpdate(
                    { key: "allowedCompletionRoles" },
                    { key: "allowedCompletionRoles", value: data.allowedCompletionRoles },
                    { upsert: true, new: true }
                ),
                Config.findOneAndUpdate(
                    { key: "allowedCreationRoles" },
                    { key: "allowedCreationRoles", value: data.allowedCreationRoles },
                    { upsert: true, new: true }
                ),
            ];
            await Promise.all(configUpdates);
        } catch (error) {
            console.error("Error saving data to MongoDB:", error);
            throw error;
        }
    } else {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
}

module.exports = {
    connectDB,
    getData,
    saveData,
};
