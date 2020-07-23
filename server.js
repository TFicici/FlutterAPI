var express = require('express');
const morgan = require('morgan');

var app = express();

app.use(morgan('combined'));

const https = require('https');
const fs = require('fs');

const mongodb = require('mongodb');
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
          "ip":"http://app-73f3769f-022c-46d3-8fca-2a676e98e048.cleverapps.io/",
          "port":3000,
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
  var serverURL="https://"+options.app.ip+":"+options.app.port+"/";
}else{
  var serverURL="http://"+options.app.ip+":"+options.app.port+"/";
}
//Sunucuda çalışması için mongouri sunucu mongourisi ile değiştirilmiştir.
//var mongouri="mongodb://"+options.database.mongoIP+":"+options.database.mongoPort;
var mongouri="mongodb://ueeofqioyppgar2vj9j5:hrGIJIl96JYhxbSl5QKe@bbe9ylivkoqel0g-mongodb.services.clever-cloud.com:27017/bbe9ylivkoqel0g";
mongodb.connect(mongouri, { useUnifiedTopology: true },function(error, client) {
  
  db = client.db(options.database.mongoDB);
  bucket = new mongodb.GridFSBucket(db, {
    bucketName: options.database.mongoBucket
  });
});


app.post('/upload/:id', function (req, res, next) {
  var filename=req.params.id;

 db.collection(options.database.mongoUrlCollection).findOne({key:filename} ,(errr, result) => {
  if(errr) {
       res.status(500).send(errr.message);
  }else{
    console.log(result);
    if(result!=null){
      req.pipe(bucket.openUploadStream(filename)).
        on('error', function(error) {
          res.status(500).send({result:"ERROR",error_reason:error});
        }).
        on('finish', function() {
          db.collection(options.database.mongoUrlCollection).deleteOne({key:filename},function(err,ress){
            if(err){
              res.status(500).send({result:"ERROR",error_reason:err.message});
            }
          });
          console.log('done!');
          res.status(200).send({result:"OK"});
        });
      }else{
        res.status(403).send("Anahtar oluşturulmamış ya da doğru değil.");
      }//ifnull
    }//else
  });
});

app.get('/download/:id', function (req, res, next) {
  var filename=req.params.id;
  bucket.openDownloadStreamByName(filename).
  on('error', function(error) {
    if(error.code=="ENOENT"){
      res.status(404).send({result:"ERROR",error_reason:error.message});
    }
    res.status(500).send({result:"ERROR",error_reason:error.message});
  }).
  on('finish', function() {
    console.log('done!');
    res.status(200).send({result:"OK"});
  }).pipe(res);
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
      res.status(500).send(error.message);
    }else{
      res.send({result:"OK"});
    }
  });
});

app.get('/',function(req,res,next){
  res.send(options.app.ip);
})

const port = process.env.PORT||27017;

if(options.app.tls==1){
  httpsServer.listen(port);
}
else{
  app.listen(port);
}
