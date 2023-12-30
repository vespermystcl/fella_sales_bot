// All credits for the production of this bot goes to KingSimpa, lead developer of Based Fellas (https://github.com/KingSimpa69).
// Check out Based Fellas here: https://opensea.io/collection/based-fellas

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const ethers = require("ethers");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const MYSTCL_ADDY = process.env.MYSTCL_ADDY;
const ABI = JSON.parse(process.env.ABI);
const MONGODB_URI = process.env.MONGODB_URI;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const salesSchema = new Schema({
  id: Number,
  mystcl: String,
  from: String,
  to: String,
  tx: String,
  block: Number,
  logged: { type: Boolean, default: false },
});

salesSchema.index({ tx: 1, mystcl: 1 }, { unique: true });

const Sales = mongoose.model("sales", salesSchema);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB!");
  client.once(Events.ClientReady, (c) => {
    console.log(`Connected to Discord!`);
    checkNFTSales();
    setInterval(checkNFTSales, 10000);
  });
  client.login(DISCORD_TOKEN);
});

process.on("SIGINT", async () => {
  console.log("Shutting down the bot...");
  await finishUp();
});

let periodInterval;

const checkNFTSales = async () => {
  try {
    const url = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    const provider = new ethers.JsonRpcProvider(url);
    const blockNumber = await provider.getBlockNumber();
    const filter = {
      address: MYSTCL_ADDY,
      fromBlock: blockNumber - 1500,
      toBlock: "latest",
    };
    const transactions = await provider.getLogs(filter);

    /* const resetColor = "\x1b[0m";
    const greenColor = "\x1b[32m";
    const addPeriod = () => process.stdout.write(".");

    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${resetColor}${greenColor}[${blockNumber}] ${resetColor}Checking for MYSTCL sales.`,
    );

    if (periodInterval) {
      clearInterval(periodInterval);
    }

    periodInterval = setInterval(addPeriod, 2800); */

    console.log(`[${blockNumber}] Checking for MYSTCL sales.`);

    for (const log of transactions) {
      try {
        const { transactionHash, blockNumber } = log;
        const contract = new ethers.Contract(MYSTCL_ADDY, ABI, provider);
        const event = contract.interface.parseLog(log);
        const { value } = await provider.getTransaction(transactionHash);
        const price = await gweiToEth(value);

        if (event.name === "Transfer" && value !== 0n) {
          const { from, to, tokenId } = event.args;

          const existingSale = await Sales.findOne({
            tx: transactionHash,
            mystcl: tokenId.toString(),
          });

          if (!existingSale || !existingSale.logged) {
            const message = {
              id: tokenId,
              from: from,
              to: to,
              tx: transactionHash,
              price: price,
            };

            if (existingSale) {
              existingSale.logged = true;
              await existingSale.save();
            } else {
              const newSale = new Sales({
                mystcl: tokenId.toString(),
                from,
                to,
                tx: transactionHash,
                block: blockNumber,
                logged: true,
              });
              await newSale.save();
            }
            await sendMessageToDiscord(message);
            /* process.stdout.clearLine();
            process.stdout.cursorTo(0); */
            console.log(`Sale found @ ${message.tx}`);
          }
        }
      } catch (error) {
        console.error("Error processing transaction:", error);
      }
    }
  } catch (error) {
    console.log(error);
  }
};

const sendMessageToDiscord = async (message) => {
  const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
  if (channel) {
    const Embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`MYSTCL #${message.id}`)
      .setURL(`https://opensea.io/assets/base/${MYSTCL_ADDY}/${message.id}`)
      .setAuthor({
        name: "MYSTCL Sales Bot",
        iconURL: "https://mystcl.xyz/assets/images/mystcls/107.png",
        url: "https://mystcl.xyz",
      })
      .setDescription(
        `MYSTCL #${message.id} has just been sold for ${message.price} ETH`,
      )
      .addFields(
        {
          name: "From",
          value: `[${shortenEthAddy(
            message.from,
          )}](https://basescan.org/address/${message.from})`,
        },
        {
          name: "To",
          value: `[${shortenEthAddy(
            message.to,
          )}](https://basescan.org/address/${message.to})`,
        },
        {
          name: "TX",
          value: `[${shortenEthAddy(message.tx)}](https://basescan.org/tx/${
            message.tx
          })`,
        },
      )
      .setImage(`https://mystcl.xyz/assets/images/mystcls/${message.id}.png`)
      .setTimestamp()
      .setFooter({
        text: "Sales Bot By KingSimpa (Based Fellas)",
        iconURL: "https://github.com/KingSimpa69",
      });
    await channel.send({ embeds: [Embed] });
  } else {
    console.error("Discord channel not found.");
  }
};

const finishUp = async () => {
  await db.close();
  await client.destroy();
  console.log("Connections closed!");
  process.exit(0);
};

const shortenEthAddy = (addy) => {
  const shorty = addy.slice(0, 5) + "..." + addy.slice(37, 41);
  return shorty;
};

const gweiToEth = async (gwei) => {
  const result = ethers.formatEther(gwei);
  return result;
};
