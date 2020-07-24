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
            "ip":"localhost",
            "port":3000,
            "tls":0,
            "privateKeyPath":"/ssl/server.key",
            "certificatePath":"/ssl/server.crt"
          },
          "database":{
            "mongoIP":"localhost",
            "mongoPort":27017,
            "mongoDB":"files",
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
    var serverURL="https://"+options.app.ip+":"+options.app.port+"/";
  }else{
    var serverURL="http://"+options.app.ip+":"+options.app.port+"/";
  }
  
  var mongouri="mongodb://"+options.database.mongoIP+":"+options.database.mongoPort+"/"+options.database.mongoDB;
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

  
  app.post("/upload/:id", upload.single("file"), (req, res) => {
    // res.json({file : req.file})
    res.send(req.params.id);
   
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
    bucket.openDownloadStreamByName(files[0].filename).pipe(res);
        
      });
  });

  app.listen(3000,options.app.ip);