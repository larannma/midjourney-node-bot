import { Midjourney } from "midjourney";
import axios from 'axios';
import FormData from 'form-data';
import request from 'request'
import fs from 'fs';
import path from 'path'

import dotenv from "dotenv";
dotenv.config();

import { saveAndSendPhoto } from "./saveAndSendPhoto.js";
import { MJ } from "../db/mjSchema.js";

let userMessageId;
let prompt;
let client;
let Imagine;
let Variation;
// https://discord.com/channels/1201442228367806524/1201442228367806526


const download = (url, path, callback) => {
  request.head(url, (err, res, body) => {
    request(url).pipe(fs.createWriteStream(path)).on('close', callback);
  });
};

const filePath = './downloads'; // Define filePath here

export const midJourney = (bot) => {
  bot.onText(/\/start/, (msg) => {
    const chatID = msg.chat.id;
    const imagePath = './intro.png'; // Update with the actual path to your image
    const caption = "Просто отправь свою фотку и стань лего человечком";

    // Send the image with a caption
    bot.sendPhoto(chatID, imagePath, { caption });
  });

  bot.on('photo', async (msg) => {
    const chatID = msg.chat.id;
    try {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const fileDetails = await bot.getFile(fileId);
  
      // Create a unique filename based on the file_id
      const fileName = `${fileDetails.file_id}.jpg`;
      const downloadFolderPath = path.join(process.cwd(), 'download'); // Save to the "download" folder
      const filePath = path.join(downloadFolderPath, fileName);

      const imageBuffer = await bot.downloadFile(fileId, downloadFolderPath);
      const data = new FormData();
      data.append('image', fs.createReadStream(imageBuffer));
      // console.log(data)
    
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://discord.com/api/webhooks/1201532143738818560/jvghQ5uBJBwPry9BksX_8WYwpSn_To-yZGwHfNSYHrHqPR87A3JefGOALDQ68hf3e8Ry',
        headers: {
          'Authorization': `Bearer ${process.env.SALAI_TOKEN}`,
          ...data.getHeaders(),
        },
        data: data,
      };
  
    try {
      const response = await axios(config);
      let FINAL = JSON.stringify(response.data.attachments[0]['url']);
      FINAL = FINAL.substring(1, FINAL.length-1)
      console.log(FINAL);
      // console.log('good');

      await bot.sendMessage(
        chatID, 
        `делаем из вас лего человечка...`,
        {
          reply_to_message_id: userMessageId,
        }
      );
      try {
        client = new Midjourney({
          ServerId: process.env.SERVER_ID,
          ChannelId: process.env.CHANNEL_ID,
          SalaiToken: process.env.SALAI_TOKEN,
          //Debug: True,
          Ws: true,
        });
        await client.init();
        Imagine = await client.Imagine(`${FINAL} as lego character, redshift render, cinematic light, f1.2, ultrasharp, masterpiece --v 6`, (uri, progress) => {
          console.log(`Loading: ${uri}, progress: ${progress}`);
        });
  
        const imgUrl = Imagine.uri;
        const imgDir = "./Imagines";
        const filePath = `${imgDir}/${userMessageId}.png`;
        bot.sendMessage(chatID, "Ваша фотка готова и загружается :)");
        saveAndSendPhoto(imgUrl, imgDir, filePath, chatID, bot);
      } catch (error) {
        bot.sendMessage(chatID, error);
      }


    } catch (error) {
      console.error(error);
    }
    } catch (error) {
      console.error('Error:', error.message);
    }
  });
  
  bot.onText(/\/imagine/, async (msg, match) => {
    userMessageId = msg.message_id;
    prompt = msg.text.replace(match[0], "").trim();
    const chatID = msg.chat.id;
    bot.sendMessage(
      chatID,
      `генерирую картинку по запросу "${prompt}"`,
      {
        reply_to_message_id: userMessageId,
      }
    );
    try {
      client = new Midjourney({
        ServerId: process.env.SERVER_ID,
        ChannelId: process.env.CHANNEL_ID,
        SalaiToken: process.env.SALAI_TOKEN,
        //Debug: True,
        Ws: true,
      });
      await client.init();
      Imagine = await client.Imagine(prompt, (uri, progress) => {
        console.log(`Loading: ${uri}, progress: ${progress}`);
      });

      const imgUrl = Imagine.uri;
      const imgDir = "./Imagines";
      const filePath = `${imgDir}/${userMessageId}.png`;
      bot.sendMessage(chatID, "Ваша фотка :)");
      saveAndSendPhoto(imgUrl, imgDir, filePath, chatID, bot);
    } catch (error) {
      bot.sendMessage(chatID, error);
    }
  });

  bot.on("callback_query", async (query) => {
    const { id: chat_id, title: chat_name } = query.message.chat;
    const message_id = query.message.message_id;
    const selectedLabel = query.data;
    try {
      if (selectedLabel.includes("U")) {
        bot.sendMessage(chat_id, `Upscaling Image ${selectedLabel}`);
        const UCustomID = Imagine.options?.find(
          (o) => o.label === selectedLabel
        )?.custom;
        const Upscale = await client.Custom({
          msgId: Imagine.id,
          flags: Imagine.flags,
          customId: UCustomID,
          loading: (uri, progress) => {
            console.log(`Loading: ${uri}, progress: ${progress}`);
          },
        });

        const imgUrl = Upscale.uri;
        const imgDir = "./Upscales";
        const filePath = `${imgDir}/${message_id}.png`;
        const options = {
          reply_to_message_id: userMessageId,
        };

        saveAndSendPhoto(imgUrl, imgDir, filePath, chat_id, bot, options);
      } else if (selectedLabel.includes("V")) {
        bot.deleteMessage(chat_id, message_id);
        bot.sendMessage(chat_id, `Generating Variants of ${selectedLabel}.`);
        const VCustomID = Imagine.options?.find(
          (o) => o.label === selectedLabel
        )?.custom;

        Variation = await client.Custom({
          msgId: Imagine.id,
          flags: Imagine.flags,
          customId: VCustomID,
          content: prompt,
          loading: (uri, progress) => {
            console.log(`Loading: ${uri}, progress: ${progress}`);
          },
        });

        const options = {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: "1", callback_data: "scale1" },
                { text: "2", callback_data: "scale2" },
                { text: "3", callback_data: "scale3" },
                { text: "4", callback_data: "scale4" },
              ],
            ],
          }),
        };

        const { id: user_id, username } = query.from;
        const mj = new MJ({
          query_id: query.id,
          message_id,
          chat_instance: query.chat_instance,
          chat_id,
          chat_name,
          user_id,
          username,
          prompt,
          data: selectedLabel,
        });

        await mj.save();

        const imgUrl = Variation.uri;
        const imgDir = "./Variations";
        const filePath = `${imgDir}/${message_id}.png`;

        saveAndSendPhoto(imgUrl, imgDir, filePath, chat_id, bot, options);

        bot.on("callback_query", async (query_up) => {
          const upscaleLabel = query_up.data;
          let imgLabel;

          switch (upscaleLabel) {
            case "scale1":
              imgLabel = "U1";
              break;
            case "scale2":
              imgLabel = "U2";
              break;
            case "scale3":
              imgLabel = "U3";
              break;
            case "scale4":
              imgLabel = "U4";
              break;
            default:
              bot.sendMessage(chat_id, "Invalid selection");
              break;
          }

          bot.sendMessage(chat_id, `Upscaling Image from Variants ${imgLabel}`);

          const upscaleCustomID = Variation.options?.find(
            (o) => o.label === imgLabel
          )?.custom;
          
          const variationUpscale = await client.Custom({
            msgId: Variation.id,
            flags: Variation.flags,
            customId: upscaleCustomID,
            loading: (uri, progress) => {
              console.log(`Loading: ${uri}, progress: ${progress}`);
            },
          });

          console.log(variationUpscale);

          const imgUrl = variationUpscale.uri;
          const imgDir = "./VariationsUpscales";
          const filePath = `${imgDir}/${message_id}.png`;
          const options = {
            reply_to_message_id: userMessageId,
          };
          saveAndSendPhoto(imgUrl, imgDir, filePath, chat_id, bot, options);
        });
      }
    } catch (error) {
      bot.sendMessage(chat_id, error, { reply_to_message_id: userMessageId });
    }
  });
};
