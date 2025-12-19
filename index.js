import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  ChannelType
} from "discord.js";
import { REST } from "@discordjs/rest";
import dotenv from "dotenv";
import fs from "fs-extra";
dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const TZ = process.env.TIMEZONE || "Asia/Bangkok";

let config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

// Load client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Time TH
function thaiTime() {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: TZ
  }).format(new Date());
}

// Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName("tellpanel")
    .setDescription("สร้าง Panel ฝากบอก (เฉพาะเจ้าของ)")
    .addChannelOption(opt =>
      opt.setName("log")
        .setDescription("@เลือกช่อง LOG ที่จะส่งข้อความฝากบอก")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
].map(c =>
  c.setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON()
);

client.once("ready", async () => {
  console.log(`🟢 Bot Ready: ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  for (const [gid] of client.guilds.cache) {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, gid),
      { body: commands }
    );
  }

  console.log("📁 โหลด config.json:", config);
});

// Slash Interaction
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;
  if (i.user.id !== ADMIN_ID)
    return i.reply({ content: "❌ Owner เท่านั้น", ephemeral: true });

  if (i.commandName === "tellpanel") {
    const logChannel = i.options.getChannel("log");

    config.logChannelId = logChannel.id;
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));

    const embed = new EmbedBuilder()
      .setTitle(`# <a:emoji_12:1449150980179366024> บอทส่งข้อความ 24/7`)
      .setImage("https://cdn.discordapp.com/attachments/1449115719479590984/1451596071263535134/Unknown.gif")
      .setDescription(`
** ╭┈ ꒰ <a:3005:1451585834649391144> : By Zemon Źx <a:3007:1451585403751633170> ꒱
> -┃ <a:New_Mail:1451388104643575912> • ฝากบอกข้อความ 
> -┃ <a:1001:1451585309757149227> • ถึงคนที่คุณ แอบรัก
> -┃ <a:1002:1451585213560783134> • หรือ คนที่คุณ แอบชอบ
> -┃ <a:1004:1451585026935488563> • หรือ แฟนคุณ ได้เลย 
╰┈ ꒰ <a:__:1451387432527335605> : xSwift Hub <a:__:1451387432527335605> ꒱ **
`);

    const btn = new ButtonBuilder()
      .setCustomId("tell_button")
      .setLabel("ฝากบอก")
      .setEmoji("<a:__:1451387747800711189>")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(btn);

    const sent = await i.reply({ embeds: [embed], components: [row] });

    config.panelChannelId = sent.channel.id;
    config.panelMessageId = (await sent.fetch()).id;
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));

    return;
  }
});

// Button -> User Select
client.on("interactionCreate", async i => {
  if (!i.isButton()) return;
  if (i.customId !== "tell_button") return;

  const select = new UserSelectMenuBuilder()
    .setCustomId("tell_select")
    .setPlaceholder("เลือก @คนที่ต้องการส่งข้อความ…")
    .setMinValues(1)
    .setMaxValues(1);

  const row = new ActionRowBuilder().addComponents(select);

  return i.reply({ content: "เลือกคนที่ต้องการส่งข้อความ 💌", components: [row], ephemeral: true });
});

// After User selected → Modal
client.on("interactionCreate", async i => {
  if (!i.isUserSelectMenu()) return;
  if (i.customId !== "tell_select") return;

  const targetUser = i.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`tell_modal_${targetUser}`)
    .setTitle("ฝากข้อความถึงคนพิเศษ 💞");

  const txt = new TextInputBuilder()
    .setCustomId("tell_msg")
    .setLabel("พิมพ์ข้อความถึงเขาที่นี่")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(txt);
  modal.addComponents(row);

  return i.showModal(modal);
});

// Modal Submit -> Send LOG
client.on("interactionCreate", async i => {
  if (!i.isModalSubmit()) return;
  if (!i.customId.startsWith("tell_modal_")) return;

  const target = i.customId.replace("tell_modal_", "");
  const msg = i.fields.getTextInputValue("tell_msg");

  const log = client.channels.cache.get(config.logChannelId);
  if (!log) return i.reply({ content: "❌ LOG channel invalid!", ephemeral: true });

  const embed = new EmbedBuilder()
    .setDescription(`
** ╭┈ ꒰ <a:3005:1451585834649391144> : <@${target}> <a:3007:1451585403751633170> ꒱  
> -┃ <a:New_Mail:1451388104643575912> • มีคนฝากข้อความถึงคุณ  
> -┃ <a:emoji_11:1449150928048361603> • คนที่ฝากบอก <@${i.user.id}> ถึงคุณ  
${msg
  .split("\n")
  .map(t => `> -┃ <a:1003:1451585110297280604> • ${t}`)
  .join("\n")}
╰┈ ꒰ <a:emoji_34:1450185227577196780> : ${thaiTime()} <a:emoji_34:1450185227577196780> ꒱ **
`);

  await log.send({ embeds: [embed] });

  return i.reply({ content: "✨ ส่งข้อความเรียบร้อย", ephemeral: true });
});

client.login(TOKEN);
