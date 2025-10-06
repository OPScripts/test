const {
    Client,
    GatewayIntentBits,
    Events,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    EmbedBuilder,
    AttachmentBuilder,
} = require("discord.js");
const path = require("path");
const { connectDB, getData, saveData } = require("./db");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const LOGO_PATH = path.join(__dirname, "attached_assets", "cruel_1759662131746.png");
const LOGO_ATTACHMENT_NAME = "cruel_1759662131746.png";
const EMBED_COLOR = "#b10026";

function createLogoAttachment() {
    return new AttachmentBuilder(LOGO_PATH, { name: LOGO_ATTACHMENT_NAME });
}

async function generateTranscript(channel) {
    try {
        const messages = [];
        let lastId;

        while (true) {
            const options = { limit: 100 };
            if (lastId) {
                options.before = lastId;
            }

            const fetchedMessages = await channel.messages.fetch(options);
            if (fetchedMessages.size === 0) break;

            fetchedMessages.forEach((msg) => messages.push(msg));
            lastId = fetchedMessages.last().id;

            if (fetchedMessages.size < 100) break;
        }

        messages.reverse();

        let transcript = `Ticket Transcript - ${channel.name}\n`;
        transcript += `Channel ID: ${channel.id}\n`;
        transcript += `Generated: ${new Date().toUTCString()}\n`;
        transcript += `${"=".repeat(80)}\n\n`;

        for (const msg of messages) {
            const timestamp = msg.createdAt.toUTCString();
            const author = `${msg.author.tag} (${msg.author.id})`;
            transcript += `[${timestamp}] ${author}:\n`;

            if (msg.content) {
                transcript += `${msg.content}\n`;
            }

            if (msg.embeds.length > 0) {
                transcript += `[Embeds: ${msg.embeds.length}]\n`;
                msg.embeds.forEach((embed, i) => {
                    transcript += `  Embed ${i + 1}:\n`;
                    if (embed.title)
                        transcript += `    Title: ${embed.title}\n`;
                    if (embed.description)
                        transcript += `    Description: ${embed.description}\n`;
                    if (embed.fields.length > 0) {
                        embed.fields.forEach((field) => {
                            transcript += `    ${field.name}: ${field.value}\n`;
                        });
                    }
                });
            }

            if (msg.attachments.size > 0) {
                transcript += `[Attachments: ${msg.attachments.size}]\n`;
                msg.attachments.forEach((att) => {
                    transcript += `  - ${att.name} (${att.url})\n`;
                });
            }

            transcript += "\n";
        }

        return transcript;
    } catch (error) {
        console.error("Error generating transcript:", error);
        return null;
    }
}

const CATEGORY_FIELDS = {
    "Ultra Weeklies": [
        "Room Name",
        "Server Name",
        "Your AQW Username",
        "Description",
    ],
    "Ultra Speaker": [
        "Room Name",
        "Server Name",
        "Your AQW Username",
        "Description",
    ],
    "Temple Shrine": [
        "Room Name",
        "Server Name",
        "Your AQW Username",
        "Description",
    ],
    "Ultra Dailies": [
        "Room Name",
        "Server Name",
        "Your AQW Username",
        "Description",
    ],
    Spamming: ["Room Name", "Server Name", "Your AQW Username", "Description"],
    Others: ["Room Name", "Server Name", "Your AQW Username", "Description"],
};

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName("setup-panel")
            .setDescription("Set up the ticket panel in the current channel")
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName("leaderboard")
            .setDescription("Display the helper leaderboard"),

        new SlashCommandBuilder()
            .setName("reset-leaderboard")
            .setDescription("Reset the helper leaderboard (Admin only)")
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName("points")
            .setDescription("Set points for a category (Admin only)")
            .addStringOption((option) =>
                option
                    .setName("category")
                    .setDescription("The ticket category")
                    .setRequired(true)
                    .addChoices(
                        { name: "Ultra Weeklies", value: "Ultra Weeklies" },
                        { name: "Ultra Speaker", value: "Ultra Speaker" },
                        { name: "Temple Shrine", value: "Temple Shrine" },
                        { name: "Ultra Dailies", value: "Ultra Dailies" },
                        { name: "Spamming", value: "Spamming" },
                        { name: "Others", value: "Others" },
                    ),
            )
            .addIntegerOption((option) =>
                option
                    .setName("points")
                    .setDescription("Number of points to award")
                    .setRequired(true)
                    .setMinValue(1),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName("setup-ticket")
            .setDescription(
                "Set the channel where tickets for a category will be created (Admin only)",
            )
            .addStringOption((option) =>
                option
                    .setName("category")
                    .setDescription("The ticket category")
                    .setRequired(true)
                    .addChoices(
                        { name: "Ultra Weeklies", value: "Ultra Weeklies" },
                        { name: "Ultra Speaker", value: "Ultra Speaker" },
                        { name: "Temple Shrine", value: "Temple Shrine" },
                        { name: "Ultra Dailies", value: "Ultra Dailies" },
                        { name: "Spamming", value: "Spamming" },
                        { name: "Others", value: "Others" },
                    ),
            )
            .addChannelOption((option) =>
                option
                    .setName("channel")
                    .setDescription("The channel where tickets will be created")
                    .setRequired(true),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName("setup-logs")
            .setDescription("Set the channel for ticket logs (Admin only)")
            .addChannelOption((option) =>
                option
                    .setName("channel")
                    .setDescription("The channel where logs will be posted")
                    .setRequired(true),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName("setup-roles")
            .setDescription(
                "Set which roles can complete/finalize tickets (Admin only)",
            )
            .addRoleOption((option) =>
                option
                    .setName("role")
                    .setDescription("The role that can complete tickets")
                    .setRequired(true),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName("setup-roles2")
            .setDescription(
                "Set which roles can create and use tickets (Admin only)",
            )
            .addRoleOption((option) =>
                option
                    .setName("role")
                    .setDescription("The role that can create tickets")
                    .setRequired(true),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    ];

    try {
        console.log("Registering slash commands...");
        await client.application.commands.set(commands);
        console.log("✅ Slash commands registered successfully!");
    } catch (error) {
        console.error("Error registering commands:", error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
        } else if (interaction.isButton()) {
            await handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        } else if (interaction.isUserSelectMenu()) {
            await handleUserSelectMenu(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModal(interaction);
        }
    } catch (error) {
        console.error("Error handling interaction:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction
                .reply({ content: "An error occurred!", ephemeral: true })
                .catch(() => {});
        }
    }
});

async function handleCommand(interaction) {
    const { commandName } = interaction;

    if (commandName === "setup-panel") {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("🎫 AQW Guild Help Desk")
            .setDescription(
                "Need help with AQW activities? Click the button below to create a help ticket!\n\nOur helpers will assist you with:\n• Ultra Weeklies\n• Ultra Speaker\n• Temple Shrine\n• Ultra Dailies\n• Spamming\n• Others\n\nClick **Create Help Ticket** to get started!",
            )
            .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

        const button = new ButtonBuilder()
            .setCustomId("create_ticket")
            .setLabel("Create Help Ticket")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🎫");

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.channel.send({ embeds: [embed], components: [row], files: [createLogoAttachment()] });
        await interaction.reply({ content: "✅ Help panel successfully created!", ephemeral: true });
    }

    if (commandName === "leaderboard") {
        const data = await getData();
        const sorted = Object.entries(data.helperPoints)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("🏆 Helper Leaderboard - Top 10")
            .setDescription(
                sorted.length === 0
                    ? "No helpers have earned points yet!"
                    : sorted
                          .map((entry, index) => {
                              const medal =
                                  index === 0
                                      ? "🥇"
                                      : index === 1
                                        ? "🥈"
                                        : index === 2
                                          ? "🥉"
                                          : `**${index + 1}.**`;
                              return `${medal} <@${entry[0]}> - ${entry[1]} point${entry[1] !== 1 ? "s" : ""}`;
                          })
                          .join("\n"),
            )
            .setFooter({ text: "Thank you to all our helpers!" })
            .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

        await interaction.reply({ embeds: [embed], files: [createLogoAttachment()] });
    }

    if (commandName === "reset-leaderboard") {
        const data = await getData();
        data.helperPoints = {};
        await saveData(data);

        await interaction.reply({
            content: "✅ Leaderboard has been reset!",
            ephemeral: true,
        });
    }

    if (commandName === "points") {
        const category = interaction.options.getString("category");
        const points = interaction.options.getInteger("points");

        const data = await getData();
        data.categoryPoints[category] = points;
        await saveData(data);

        await interaction.reply({
            content: `✅ Points for **${category}** set to **${points}** point${points !== 1 ? "s" : ""}!`,
            ephemeral: true,
        });
    }

    if (commandName === "setup-ticket") {
        const category = interaction.options.getString("category");
        const channel = interaction.options.getChannel("channel");

        const data = await getData();
        data.ticketChannels[category] = channel.id;
        await saveData(data);

        await interaction.reply({
            content: `✅ Tickets for **${category}** will now be created in ${channel}!`,
            ephemeral: true,
        });
    }

    if (commandName === "setup-logs") {
        const channel = interaction.options.getChannel("channel");

        const data = await getData();
        data.logsChannel = channel.id;
        await saveData(data);

        await interaction.reply({
            content: `✅ Ticket logs will now be posted to ${channel}!`,
            ephemeral: true,
        });
    }

    if (commandName === "setup-roles") {
        const role = interaction.options.getRole("role");

        const data = await getData();
        if (!data.allowedCompletionRoles.includes(role.id)) {
            data.allowedCompletionRoles.push(role.id);
            await saveData(data);
            await interaction.reply({
                content: `✅ Role ${role} has been added to the list of roles that can complete tickets!`,
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: `❌ Role ${role} is already in the list of allowed completion roles!`,
                ephemeral: true,
            });
        }
    }

    if (commandName === "setup-roles2") {
        const role = interaction.options.getRole("role");

        const data = await getData();
        if (!data.allowedCreationRoles.includes(role.id)) {
            data.allowedCreationRoles.push(role.id);
            await saveData(data);
            await interaction.reply({
                content: `✅ Role ${role} has been added to the list of roles that can create tickets!`,
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: `❌ Role ${role} is already in the list of allowed creation roles!`,
                ephemeral: true,
            });
        }
    }
}

async function handleButton(interaction) {
    if (interaction.customId === "create_ticket") {
        const data = await getData();
        const member = interaction.member;

        if (data.allowedCreationRoles.length > 0) {
            const hasAllowedRole = member.roles.cache.some((role) =>
                data.allowedCreationRoles.includes(role.id),
            );
            if (!hasAllowedRole) {
                await interaction.reply({
                    content:
                        "❌ You do not have permission to create tickets. Please contact an administrator.",
                    ephemeral: true,
                });
                return;
            }
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("ticket_category")
            .setPlaceholder("Select help category")
            .addOptions([
                {
                    label: "Ultra Weeklies",
                    value: "Ultra Weeklies",
                    emoji: "⚔️",
                },
                {
                    label: "Ultra Speaker",
                    value: "Ultra Speaker",
                    emoji: "🗣️",
                },
                {
                    label: "Temple Shrine",
                    value: "Temple Shrine",
                    emoji: "⛩️",
                },
                {
                    label: "Ultra Dailies",
                    value: "Ultra Dailies",
                    emoji: "📅",
                },
                {
                    label: "Spamming",
                    value: "Spamming",
                    emoji: "💥",
                },
                {
                    label: "Others",
                    value: "Others",
                    emoji: "📋",
                },
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: "Please select the type of help you need:",
            components: [row],
            ephemeral: true,
        });
    }

    if (interaction.customId === "complete_ticket") {
        const data = await getData();
        const ticket = data.activeTickets[interaction.channel.id];

        if (!ticket) {
            await interaction.reply({
                content: "❌ Ticket data not found!",
                ephemeral: true,
            });
            return;
        }

        const member = interaction.member;
        const isCreator = member.id === ticket.userId;
        const hasAllowedRole = member.roles.cache.some((role) =>
            data.allowedCompletionRoles.includes(role.id),
        );

        if (hasAllowedRole) {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId("select_helpers")
                .setPlaceholder(
                    "Select or Type helper(s) who helped this ticket",
                )
                .setMinValues(1)
                .setMaxValues(25);

            const row = new ActionRowBuilder().addComponents(userSelect);

            await interaction.reply({
                content:
                    "Please type/select the helper(s) who helped this ticket:",
                components: [row],
                ephemeral: true,
            });
            return;
        }

        if (isCreator) {
            await interaction.channel.send({
                content:
                    "✅ This ticket has been marked as completed. Only admins, mods, or authorized roles can finalize this ticket.",
            });
            await interaction.reply({
                content:
                    "✅ Ticket marked as complete. Waiting for authorized staff to finalize.",
                ephemeral: true,
            });
            return;
        }

        await interaction.reply({
            content:
                "Pussy. ❌ You can't mark the ticket as complete, you're not the ticket creator.",
            ephemeral: true,
        });
    }

    if (interaction.customId === "cancel_ticket") {
        const data = await getData();
        const ticket = data.activeTickets[interaction.channel.id];

        if (!ticket) {
            await interaction.reply({
                content: "❌ Ticket data not found!",
                ephemeral: true,
            });
            return;
        }

        const guild = interaction.guild;
        const member = interaction.member;
        const isCreator = member.id === ticket.userId;
        const hasAdminPermission = member.permissions.has(
            PermissionFlagsBits.Administrator,
        );
        const hasAllowedRole = member.roles.cache.some((role) =>
            data.allowedCompletionRoles.includes(role.id),
        );
        const canCancel = isCreator || hasAdminPermission || hasAllowedRole;

        if (!canCancel) {
            await interaction.reply({
                content:
                    "❌ Only the ticket creator or moderators/admins can cancel this ticket!",
                ephemeral: true,
            });
            return;
        }

        delete data.activeTickets[interaction.channel.id];
        await saveData(data);

        if (data.logsChannel) {
            const logsChannel = guild.channels.cache.get(data.logsChannel);
            if (logsChannel && logsChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle("❌ Ticket Canceled")
                    .addFields(
                        {
                            name: "Ticket Number",
                            value: `#${ticket.ticketNumber}`,
                            inline: true,
                        },
                        {
                            name: "Category",
                            value: ticket.category,
                            inline: true,
                        },
                        {
                            name: "Created By",
                            value: `<@${ticket.userId}>`,
                            inline: true,
                        },
                        {
                            name: "Canceled By",
                            value: `<@${interaction.user.id}>`,
                            inline: true,
                        },
                    )
                    .setTimestamp()
                    .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

                await logsChannel.send({ embeds: [logEmbed], files: [createLogoAttachment()] }).catch(() => {});
            }
        }

        const cancelEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("❌ Ticket Canceled")
            .setDescription(
                "This ticket has been canceled.\n\nGenerating transcript and closing in 10 seconds...",
            )
            .setTimestamp()
            .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

        await interaction.reply({ embeds: [cancelEmbed], files: [createLogoAttachment()] });

        const transcriptText = await generateTranscript(interaction.channel);

        if (transcriptText) {
            const buffer = Buffer.from(transcriptText, "utf-8");

            if (data.logsChannel) {
                const logsChannel = guild.channels.cache.get(data.logsChannel);
                if (logsChannel && logsChannel.isTextBased()) {
                    const transcriptAttachment = new AttachmentBuilder(buffer, {
                        name: `ticket-${ticket.ticketNumber}-transcript.txt`,
                    });
                    await logsChannel
                        .send({
                            content: `Transcript for canceled ticket #${ticket.ticketNumber}:`,
                            files: [transcriptAttachment],
                        })
                        .catch(() => {});
                }
            }
        }

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error("Error deleting channel:", error);
            }
        }, 10000);
    }

    if (interaction.customId === "confirm_completion") {
        const data = await getData();
        const ticket = data.activeTickets[interaction.channel.id];

        if (!ticket) {
            await interaction.reply({
                content: "❌ Ticket data not found!",
                ephemeral: true,
            });
            return;
        }

        if (!ticket.selectedHelpers || ticket.selectedHelpers.length === 0) {
            await interaction.reply({
                content: "❌ No helpers were selected!",
                ephemeral: true,
            });
            return;
        }

        const guild = interaction.guild;
        const category = ticket.category;
        const pointsPerHelper = data.categoryPoints[category] || 1;
        const selectedUserIds = ticket.selectedHelpers;

        selectedUserIds.forEach((helperId) => {
            if (!data.helperPoints[helperId]) {
                data.helperPoints[helperId] = 0;
            }
            data.helperPoints[helperId] += pointsPerHelper;
        });

        delete data.activeTickets[interaction.channel.id];
        await saveData(data);

        const helperMentions = selectedUserIds
            .map((id) => `<@${id}>`)
            .join(", ");

        if (data.logsChannel) {
            const logsChannel = guild.channels.cache.get(data.logsChannel);
            if (logsChannel && logsChannel.isTextBased()) {
                const totalPoints = pointsPerHelper * selectedUserIds.length;
                const logEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle("✅ Ticket Completed")
                    .addFields(
                        {
                            name: "Ticket Number",
                            value: `#${ticket.ticketNumber}`,
                            inline: true,
                        },
                        { name: "Category", value: category, inline: true },
                        {
                            name: "Created By",
                            value: `<@${ticket.userId}>`,
                            inline: true,
                        },
                        {
                            name: "Completed By",
                            value: `<@${ticket.completedBy}>`,
                            inline: true,
                        },
                        {
                            name: "Helpers Mentioned",
                            value: helperMentions,
                            inline: false,
                        },
                        {
                            name: "Points Awarded",
                            value: `${pointsPerHelper} point${pointsPerHelper !== 1 ? "s" : ""} per helper (${totalPoints} total)`,
                            inline: false,
                        },
                    )
                    .setTimestamp()
                    .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

                await logsChannel.send({ embeds: [logEmbed], files: [createLogoAttachment()] }).catch(() => {});
            }
        }

        const closeEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("✅ Ticket Completed")
            .setDescription(
                `**Helpers awarded ${pointsPerHelper} point${pointsPerHelper !== 1 ? "s" : ""} each:**\n${helperMentions}\n\nGenerating transcript and closing in 10 seconds...`,
            )
            .setTimestamp()
            .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

        await interaction.reply({ embeds: [closeEmbed], files: [createLogoAttachment()] });

        const transcriptText = await generateTranscript(interaction.channel);

        if (transcriptText) {
            const buffer = Buffer.from(transcriptText, "utf-8");

            if (data.logsChannel) {
                const logsChannel = guild.channels.cache.get(data.logsChannel);
                if (logsChannel && logsChannel.isTextBased()) {
                    const transcriptAttachment = new AttachmentBuilder(buffer, {
                        name: `ticket-${ticket.ticketNumber}-transcript.txt`,
                    });
                    await logsChannel
                        .send({
                            content: `Transcript for completed ticket #${ticket.ticketNumber}:`,
                            files: [transcriptAttachment],
                        })
                        .catch(() => {});
                }
            }
        }

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error("Error deleting channel:", error);
            }
        }, 10000);
    }

    if (interaction.customId === "cancel_completion") {
        const data = await getData();
        const ticket = data.activeTickets[interaction.channel.id];

        if (!ticket) {
            await interaction.reply({
                content: "❌ Ticket data not found!",
                ephemeral: true,
            });
            return;
        }

        delete ticket.selectedHelpers;
        delete ticket.completedBy;
        await saveData(data);

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId("select_helpers")
            .setPlaceholder("Select helper(s) who resolved this ticket")
            .setMinValues(1)
            .setMaxValues(25);

        const row = new ActionRowBuilder().addComponents(userSelect);

        await interaction.update({
            content: "Please select the helper(s) who resolved this ticket:",
            components: [row],
        });
    }
}

async function handleSelectMenu(interaction) {
    if (interaction.customId === "ticket_category") {
        const category = interaction.values[0];
        const fields = CATEGORY_FIELDS[category];

        const modal = new ModalBuilder()
            .setCustomId(`ticket_form_${category}`)
            .setTitle(`${category} - Help Request`);

        fields.forEach((fieldName, index) => {
            const input = new TextInputBuilder()
                .setCustomId(`field_${index}`)
                .setLabel(fieldName)
                .setStyle(
                    fieldName === "Description"
                        ? TextInputStyle.Paragraph
                        : TextInputStyle.Short,
                )
                .setRequired(fieldName !== "Description");

            if (fieldName === "Room Name") {
                input.setPlaceholder("Ex: Ultranulgath-6969");
            } else if (fieldName === "Server Name") {
                input.setPlaceholder("Ex: Safiria");
            } else if (fieldName === "Your AQW Username") {
                input.setPlaceholder("Ex: Aenaen");
            } else if (fieldName === "Description") {
                input.setPlaceholder("Briefly describe your request (Optional)");
                input.setMaxLength(1024);
            }

            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);
        });

        await interaction.showModal(modal);
    }
}

async function handleUserSelectMenu(interaction) {
    if (interaction.customId === "select_helpers") {
        const selectedUserIds = interaction.values;

        if (selectedUserIds.length === 0) {
            await interaction.reply({
                content: "❌ No helpers selected!",
                ephemeral: true,
            });
            return;
        }

        const data = await getData();
        const ticket = data.activeTickets[interaction.channel.id];

        if (!ticket) {
            await interaction.reply({
                content: "❌ Ticket data not found!",
                ephemeral: true,
            });
            return;
        }

        ticket.selectedHelpers = selectedUserIds;
        ticket.completedBy = interaction.user.id;
        await saveData(data);

        const helperMentions = selectedUserIds
            .map((id) => `<@${id}>`)
            .join(", ");

        const confirmButton = new ButtonBuilder()
            .setCustomId("confirm_completion")
            .setLabel("Confirm")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅");

        const cancelButton = new ButtonBuilder()
            .setCustomId("cancel_completion")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌");

        const row = new ActionRowBuilder().addComponents(
            confirmButton,
            cancelButton,
        );

        await interaction.reply({
            content: `**Selected Helpers:**\n${helperMentions}\n\nPlease confirm to finalize the ticket and award points, or cancel to select different helpers.`,
            components: [row],
            ephemeral: true,
        });
    }
}

async function handleModal(interaction) {
    if (interaction.customId.startsWith("ticket_form_")) {
        await interaction.deferReply({ ephemeral: true });

        const category = interaction.customId.replace("ticket_form_", "");
        const fields = CATEGORY_FIELDS[category];

        const data = await getData();
        data.ticketCounter++;
        const ticketNumber = data.ticketCounter;

        const fieldValues = fields.map((field, index) => {
            const value = interaction.fields.getTextInputValue(`field_${index}`);
            return {
                name: field,
                value: value || "N/A",
            };
        });

        const guild = interaction.guild;
        const helpersRole = guild.roles.cache.find(
            (role) => role.name.toLowerCase() === "helpers",
        );

        const channelName = `ticket-${ticketNumber}`;
        const permissionMap = new Map();

        permissionMap.set(guild.id, {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
        });

        permissionMap.set(interaction.user.id, {
            id: interaction.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
            ],
        });

        if (helpersRole) {
            permissionMap.set(helpersRole.id, {
                id: helpersRole.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                ],
            });
        }

        guild.roles.cache.forEach((role) => {
            if (
                role.permissions.has(PermissionFlagsBits.Administrator) ||
                role.permissions.has(PermissionFlagsBits.ModerateMembers)
            ) {
                if (!permissionMap.has(role.id)) {
                    permissionMap.set(role.id, {
                        id: role.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                        ],
                    });
                }
            }
        });

        data.allowedCompletionRoles.forEach((roleId) => {
            const role = guild.roles.cache.get(roleId);
            if (role && !permissionMap.has(roleId)) {
                permissionMap.set(roleId, {
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                    ],
                });
            }
        });

        data.allowedCreationRoles.forEach((roleId) => {
            const role = guild.roles.cache.get(roleId);
            if (role && !permissionMap.has(roleId)) {
                permissionMap.set(roleId, {
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                    ],
                });
            }
        });

        const createOptions = {
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: Array.from(permissionMap.values()),
        };

        if (data.ticketChannels[category]) {
            const targetChannel = guild.channels.cache.get(
                data.ticketChannels[category],
            );
            if (targetChannel) {
                if (targetChannel.type === ChannelType.GuildCategory) {
                    createOptions.parent = targetChannel.id;
                } else if (targetChannel.parent) {
                    createOptions.parent = targetChannel.parent.id;
                }
            }
        }

        const channel = await guild.channels.create(createOptions);

        const ticketEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(`🎫 Help Ticket #${ticketNumber}`)
            .setDescription(
                `**Category:** ${category}\n**Created by:** <@${interaction.user.id}>`,
            )
            .addFields(fieldValues)
            .setTimestamp()
            .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

        const completeButton = new ButtonBuilder()
            .setCustomId("complete_ticket")
            .setLabel("Complete Ticket")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅");

        const cancelButton = new ButtonBuilder()
            .setCustomId("cancel_ticket")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌");

        const row = new ActionRowBuilder().addComponents(
            completeButton,
            cancelButton,
        );

        let mentionText = "";
        if (helpersRole && data.allowedCreationRoles.includes(helpersRole.id)) {
            mentionText = `${helpersRole}`;
        }

        const messageContent = mentionText
            ? `${mentionText} - New help request!`
            : "New help request!";

        await channel.send({
            content: messageContent,
            embeds: [ticketEmbed],
            components: [row],
            files: [createLogoAttachment()],
        });

        data.activeTickets[channel.id] = {
            ticketNumber: ticketNumber,
            userId: interaction.user.id,
            category: category,
            fields: fieldValues,
        };
        await saveData(data);

        if (data.logsChannel) {
            const logsChannel = guild.channels.cache.get(data.logsChannel);
            if (logsChannel && logsChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle("📝 Ticket Created")
                    .addFields(
                        {
                            name: "Ticket Number",
                            value: `#${ticketNumber}`,
                            inline: true,
                        },
                        { name: "Category", value: category, inline: true },
                        {
                            name: "Created By",
                            value: `<@${interaction.user.id}>`,
                            inline: true,
                        },
                        { name: "Channel", value: `${channel}`, inline: false },
                        ...fieldValues,
                    )
                    .setTimestamp()
                    .setThumbnail(`attachment://${LOGO_ATTACHMENT_NAME}`);

                await logsChannel.send({ embeds: [logEmbed], files: [createLogoAttachment()] }).catch(() => {});
            }
        }

        await interaction.editReply({
            content: `✅ Ticket created! Check ${channel}`,
        });
    }
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error(
        "❌ Error: DISCORD_BOT_TOKEN environment variable is not set!",
    );
    console.log("Please add your Discord bot token to Secrets.");
    process.exit(1);
}

(async () => {
    await connectDB();
    
    client.login(token).catch((error) => {
        console.error("❌ Failed to login to Discord:", error);
        process.exit(1);
    });
})();
