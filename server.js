const express = require("express");
const app = express();
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");
const mongodb = require('mongodb');

const https = require('https');
const fs = require('fs');

const guID=require("guid");
const config = require('config');

try {
    if(fs.existsSync('config/default.json')) {
        console.log("The file exists.");
        var options={
          "app":{
            "ip":config.get('app.ip'),
            "port":config.get('app.port'),
            "tls":config.get('app.tls'),
            "privateKeyPath":config.get('app.privateKeyPath'),
            "certificatePath":config.get('app.certificatePath')
          },
          "database":{
            "mongoIP":config.get('database.mongoIP'),
            "mongoPort":config.get('database.mongoPort'),
            "mongoDB":config.get('database.mongoDB'),
            "mongoBucket":config.get('database.mongoBucket'),
            "mongoUrlCollection":config.get('database.mongoUrlCollection')
          }
        };
    } else {
        console.log('The file does not exist.');
        var options={
          "app":{
            "ip":"app-73f3769f-022c-46d3-8fca-2a676e98e048.cleverapps.io",
            "port":0,
            "tls":0,
            "privateKeyPath":"/ssl/server.key",
            "certificatePath":"/ssl/server.crt"
          },
          "database":{
            "mongoIP":"ueeofqioyppgar2vj9j5:hrGIJIl96JYhxbSl5QKe@bbe9ylivkoqel0g-mongodb.services.clever-cloud.com",
            "mongoPort":27017,
            "mongoDB":"bbe9ylivkoqel0g",
            "mongoBucket":"uploads",
            "mongoUrlCollection":"url"
          }
      };
      
      var objectDefault=JSON.stringify(options,null,'\t');
      if(!fs.existsSync('./config')){
        console.log("dosyayok");
        fs.mkdirSync('./config');
      }
      fs.writeFile('config/default.json', objectDefault, function (err) {
        if (err) {
          console.log('config/default.json oluşturulamadı.');
          console.log(err.message);
          return;
        }
        console.log('config/default.json oluşturuldu.')
      });
    }
  } catch (err) {
    console.error(err);
  }
  
  if(options.app.tls==1){
    var privateKey  = fs.readFileSync(__dirname +options.app.privateKeyPath);
    var certificate = fs.readFileSync(__dirname +options.app.certificatePath);
    var credentials = {key: privateKey, cert: certificate};
    var httpsServer = https.createServer(credentials, app);
  }
  
  var bucket;
  var db;
  if(options.app.tls==1){
    if(options.app.port!=0){
      var serverURL="https://"+options.app.ip+":"+options.app.port+"/";}
    else{
      var serverURL="https://"+options.app.ip+"/";}//port bilgisi verilmediğinde

  }else{
    if(options.app.port!=0){
      var serverURL="http://"+options.app.ip+":"+options.app.port+"/";}
    else{
      var serverURL="http://"+options.app.ip+"/";}//port bilgisi verilmediğinde
    
  }
  
  var mongouri="mongodb://ueeofqioyppgar2vj9j5:hrGIJIl96JYhxbSl5QKe@bbe9ylivkoqel0g-mongodb.services.clever-cloud.com:27017/bbe9ylivkoqel0g";
  mongodb.connect(mongouri, { useUnifiedTopology: true },function(error, client) {
    
    db = client.db(options.database.mongoDB);
    bucket = new mongodb.GridFSBucket(db, {
      bucketName: options.database.mongoBucket
    });
  });
  

  const storage = new GridFsStorage({
    url: mongouri,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
          const fileInfo = {
            metadata:req.params.id,
            filename: file.originalname,
            bucketName: options.database.mongoBucket
          };
          resolve(fileInfo);
        });
    }
  });

   
  const upload = multer({
    storage
  });
  var varUpload = upload.single('file');
  
  app.post("/upload/:id", (req, res) => {

    var filename=req.params.id;
    db.collection(options.database.mongoUrlCollection).findOne({key:filename} ,(errr, result) => {
        if(errr) {
             res.status(500).send(errr.message);
        }else{
          if(result!=null){
            varUpload(req, res, function (err) {
                if (err) {
                     res.status(500).send({result:"ERROR",error_reason:err.message});
                 }
                 res.status(200).send({result:"OK"});
               })
            }else{
              res.status(403).send("Anahtar oluşturulmamış ya da doğru değil.");
            }//ifnull
          }//else
        });
  });



  app.get("/download/:id", (req, res) => {
    const file = bucket
      .find({
        metadata: req.params.id
      })
      .toArray((err, files) => {
        if (!files || files.length === 0) {
          return res.status(404).json({
            err: "no files exist"
          });
        }
    
    console.log(files[0].metadata);
    res.set('Content-Disposition', 'attachment; filename=\"'+files[0].filename+'\"');    
    bucket.openDownloadStreamByName(files[0].filename).pipe(res);
        
      });
  });

  app.get("/generateURL",(req,res)=>{
    var guid =guID.create();
    guid=""+guid;
    genurl =serverURL+"upload/"+guid;
  
    var myobj = { createTime:new Date(),key:guid,url:genurl};
    db.collection(options.database.mongoUrlCollection).insertOne(myobj, function(err, ress) {
      if (err){
        res.status(500).send({result:"ERROR",error_reason:err.message});
      }
      console.log("1 document inserted");
      res.status(200).send({result:"OK",url:genurl,expires:180});
    });
  });


  app.get("/generateURLControl/:url",(req,res)=>{
    var alinanURL=String(req.params.url);
    db.collection(options.database.mongoUrlCollection).findOne({key:alinanURL} ,(error, result) => {
      if(error) {
        res.status(403).send("URL not found.");
      }else{
        if(result!=null){
          res.status(200).send({result:"OK"})
      }else{
          res.status(403).send("Anahtar oluşturulmamış ya da doğru değil.");
        }//if
      }
    });
  });


  const port = process.env.PORT||27017;

  if(options.app.tls==1){
    httpsServer.listen(port);
  }
  else{
    app.listen(port);
  }