const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
    ticketNumber: {
        type: Number,
        required: true,
    },
    channelId: {
        type: String,
        required: true,
        unique: true,
    },
    userId: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    fields: {
        type: Array,
        default: [],
    },
    selectedHelpers: {
        type: Array,
        default: [],
    },
    completedBy: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        default: "open",
    },
});

module.exports = mongoose.model("Ticket", ticketSchema);
