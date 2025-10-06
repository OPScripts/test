# Overview

This is a Discord bot built with discord.js v14 that manages a comprehensive ticket system with helper points and leaderboard functionality. The bot is designed for an AQW (AdventureQuest Worlds) guild to handle support requests across five categories: Ultra Weeklies, Ultra Speaker, Temple Shrine, Ultra Dailies, and Spamming. The system tracks helper contributions through a points system with an interactive leaderboard.

**Last Updated:** October 6, 2025
**Status:** Fully functional and production-ready with MongoDB support

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

**Dual-Mode Data Persistence**: The application supports both MongoDB and JSON file storage with automatic fallback:
- **MongoDB Mode** (when `MONGO_URI` environment variable is set):
  - Uses mongoose for database operations
  - Automatic migration from data.json on first connection
  - Suitable for production deployments and high-concurrency scenarios
  - Better scalability and performance
- **JSON File Fallback** (when `MONGO_URI` is not set):
  - Uses `data.json` for local storage
  - Simple setup with no external database dependencies
  - Easy data inspection and manual editing if needed
  - Sufficient for development and small to medium-sized Discord servers

The data structure tracks nine main entities:
- `helperPoints`: Object mapping user IDs to their accumulated points (MongoDB: Helper model)
- `activeTickets`: Object storing currently open ticket information (MongoDB: Ticket model)
- `ticketCounter`: Incrementing integer for generating unique ticket IDs (MongoDB: Config model)
- `categoryPoints`: Object mapping category names to point values (MongoDB: Config model)
- `ticketChannels`: Object mapping category names to channel/category IDs (MongoDB: Config model)
- `logsChannel`: Channel ID where ticket logs are posted (MongoDB: Config model)
- `allowedCompletionRoles`: Array of role IDs that can complete/finalize tickets (MongoDB: Config model)
- `allowedCreationRoles`: Array of role IDs that can create and use tickets (MongoDB: Config model)

## Bot Architecture

**Discord.js Gateway Bot**: Uses the standard Discord Gateway API with intents (`GatewayIntentBits.Guilds` and `GatewayIntentBits.GuildMessages`), which:
- Reduces memory footprint and API rate limit consumption
- Focuses on slash commands and guild-level interactions
- Enables transcript generation by fetching message history
- Note: MessageContent intent can be enabled in Discord Developer Portal for full message content in transcripts

**Slash Command Interface**: The bot implements Discord's slash command system with:
- `/setup-panel`: Admin-only command to initialize the ticket interface in any channel
- `/leaderboard`: Public command to display top 10 helper rankings
- `/reset-leaderboard`: Admin-only command to reset all helper points
- `/points <category> <points>`: Admin-only command to set custom point values for each category
- `/setup-ticket <category> <channel>`: Admin-only command to route tickets to specific channels/categories
- `/setup-logs <channel>`: Admin-only command to designate a logging channel for ticket events
- `/setup-roles <role>`: Admin-only command to add roles that can complete/finalize tickets
- `/setup-roles2 <role>`: Admin-only command to add roles that can create and use tickets

## Ticket System Design

**Category-based Tickets**: The system organizes tickets into predefined categories, each with specific required fields:
- All categories collect: Room Name, Server Name, AQW Username
- This structured approach ensures consistent data collection across all ticket types
- Modal-based input collection for structured data entry

**Component-based UI**: The architecture uses Discord's interactive components:
- Buttons for ticket creation, completion, and cancellation actions
- String select menus for category selection
- User select menus for multi-helper selection (allows 1-25 selections)
- Modals for detailed information input
- Action rows to organize interactive elements

## Data Flow

**Unified Data Abstraction Layer** (`db.js`):
- `connectDB()`: Initializes connection (MongoDB if MONGO_URI exists, otherwise fallback mode)
- `getData()`: Async function to retrieve all data (from MongoDB or data.json)
- `saveData(data)`: Async function to persist data (to MongoDB or data.json)
- Automatic migration from data.json to MongoDB on first connection
- Transparent switching between storage backends

**MongoDB Operations** (when enabled):
- Uses mongoose schemas for data validation
- Helper model: stores user points
- Ticket model: stores active ticket information
- Config model: stores configuration key-value pairs
- Atomic operations for data consistency

**JSON File Operations** (fallback mode):
- Synchronous file I/O (`readFileSync`/`writeFileSync`) within db.js
- Simple error handling and code flow
- Acceptable for low-frequency operations (ticket creation/closure)

# External Dependencies

## Discord.js Library (v14.22.1)

Primary framework providing:
- Gateway connection management and WebSocket handling
- Slash command builders and registration
- Interactive component handling (buttons, modals, select menus)
- Event system for Discord events
- Permission and intent management

## Mongoose (v8.9.4)

MongoDB ODM (Object Data Modeling) library:
- Schema-based data validation
- Connection pooling and management
- Query building and execution
- Middleware and hooks support
- Used only when MONGO_URI environment variable is set

## Node.js Built-in Modules

- **fs (File System)**: Handles reading/writing the JSON data file (in fallback mode)
- **path**: Manages file path construction in a cross-platform manner

## Discord API

The bot integrates with Discord's REST and Gateway APIs:
- **Gateway API**: Real-time event subscription and bot presence
- **Slash Commands API**: Command registration and handling
- **Interactions API**: Button clicks, modal submissions, select menu selections
- **Permissions System**: Role-based access control for administrative commands

## Runtime Environment

Expected deployment on Replit or similar Node.js hosting platform with:
- Persistent file storage for `data.json`
- Environment variable support for Discord bot token (`DISCORD_BOT_TOKEN`)
- Always-on or keep-alive mechanism to maintain bot connection

# Recent Changes

**October 6, 2025 - MongoDB Integration:**
- **Added MongoDB Support with Automatic Fallback:**
  - Integrated mongoose for MongoDB connectivity
  - Created `db.js` abstraction layer for unified data operations
  - Bot automatically uses MongoDB when `MONGO_URI` environment variable is set
  - Falls back to `data.json` when MongoDB is not configured
  - Zero-setup required - works out of the box in both modes
- **Database Models Created:**
  - `Helper` model: stores userId and points
  - `Ticket` model: stores ticket information with channel tracking
  - `Config` model: stores configuration key-value pairs
- **Automatic Data Migration:**
  - Migrates existing data.json to MongoDB on first connection
  - Preserves all existing data during migration
  - Logs clearly indicate which storage mode is active
- **Updated index.js:**
  - Replaced direct file operations with async db.js functions
  - All data operations now use `await getData()` and `await saveData()`
  - Maintains all existing features and commands
- **Production Ready:**
  - Can be deployed to Railway or similar platforms with MongoDB
  - Simply add MONGO_URI environment variable to enable database mode
  - No code changes needed to switch between storage modes

# Recent Changes

**October 5, 2025 - Ticket Completion Restrictions and Transcript Updates:**
- **Restricted Ticket Completion:**
  - Only the ticket creator can now click the "Complete Ticket" button
  - Other users (including mods/admins) will receive an ephemeral error message
  - Prevents spam or random users from closing tickets they don't own
- **Transcript Delivery Change:**
  - Transcripts are now sent only to the log channel (set up via `/setup-log`)
  - Removed automatic DM delivery of transcripts to users
  - Centralizes all ticket records in the log channel for better management

**October 1, 2025 - Ticket Visibility, Mentions, and Transcripts Update:**
- **Enhanced Ticket Visibility:**
  - All roles configured via `/setup-roles2` (creation roles) now automatically receive view and message permissions in ticket channels
  - Ensures helpers and support staff can see and respond to all tickets regardless of who created them
  - Role existence checks prevent errors when roles are deleted from the server
- **Fixed Mention System:**
  - Removed automatic mentions of all creation roles when tickets are created
  - Only mentions @Helpers role if it exists AND is configured in `/setup-roles2`
  - Cleaner ticket notifications without unnecessary pings
- **Transcript Feature:**
  - Automatic transcript generation when tickets are completed or canceled
  - Transcripts saved as .txt files containing full conversation history with timestamps
  - Includes message content, embeds, and attachment URLs
  - Transcripts sent only to configured logs channel for record-keeping
  - Fetches all messages in batches (up to 100 at a time) to ensure complete history
  - Note: Enable MessageContent intent in Discord Developer Portal for full message content visibility

**October 1, 2025 - Latest Update:**
- **Dynamic Role Management:**
  - Added `/setup-roles` command to configure which roles can complete/finalize tickets
  - Added `/setup-roles2` command to configure which roles can create and use tickets
  - Roles are stored dynamically in data.json and can be updated anytime by administrators
  - Replaced hardcoded role IDs with flexible, configurable role system
- **Ticket Creation Permissions:**
  - Users without roles set via `/setup-roles2` cannot create tickets
  - Ticket pings only mention roles configured in `/setup-roles2` (instead of generic helpers role)
  - Ticket channels automatically grant view/send permissions to completion roles
- **Confirmation Flow for Ticket Completion:**
  - Added confirmation step after helper selection with "Confirm" and "Cancel" buttons
  - Confirm button finalizes ticket (awards points, logs, deletes channel)
  - Cancel button reopens helper selection dropdown
  - Prevents accidental ticket completion and allows helper re-selection
- **Permission System:**
  - Complete ticket requires user to be the ticket creator (only ticket creator can mark as complete)
  - Cancel ticket requires ticket creator, Administrator, OR roles set via `/setup-roles`
  - Non-permitted users trying to complete receive message: "❌ Only the ticket creator can mark this ticket as complete."
- **User Select Dropdown for Helpers:**
  - Interactive User Select dropdown for selecting multiple helpers (1-25 users)
  - Helper mentions use proper Discord format (<@id>) for pinging
  - Points automatically awarded to all selected helpers after confirmation
- **Cancel Ticket Feature:**
  - Added cancel button next to complete ticket button
  - Logs canceled tickets with ticket number, category, creator, and who canceled it
  - Deletes ticket channel after 10 seconds

**October 1, 2025 - Major Update:**
- Initial implementation of complete ticket system with all requested features
- Added moderator/admin access to ticket channels via automatic permission overwrites
- Implemented duplicate helper points prevention using Set deduplication
- Added permission overwrites deduplication using Map to prevent API issues
- **New Features Added:**
  - `/points` command for admins to set custom point values per category
  - `/setup-ticket` command to route tickets to specific channels or categories
  - `/setup-logs` command to set a logging channel for ticket events
  - Category-specific point attribution (helpers earn configured points per category)
  - Comprehensive logging system tracking ticket creation and completion
  - Total points calculation in completion logs
- Fixed critical bug: Changed `isCommand()` to `isChatInputCommand()` for discord.js v14 compatibility
- Bot tested and running successfully in production
