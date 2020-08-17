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
          },
          "viewOptions":{
            "perPageData":config.get("viewOptions.perPageData")
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
          },
          "viewOptions":{
            "perPageData":2
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
          res.status(500).send({result:"ERROR",error_reason:errr.message});
        }else{
          if(result!=null){
            varUpload(req, res, function (err) {
                if (err) {
                     res.status(500).send({result:"ERROR",error_reason:err.message});
                 }
                 db.collection(options.database.mongoUrlCollection).deleteOne({key:filename},function(err,ress){
                  if(err){
                    res.status(500).send({result:"ERROR",error_reason:err.message});
                  }
                });
                console.log('done!');
        
                 res.status(200).send({result:"OK"});
               })
            }else{
              res.status(403).send({result:"ERROR",error_reason:"Anahtar oluşturulmamış ya da doğru değil."});
            }
          }
        });
  });




  app.get("/download/:id", (req, res) => {
    const file = bucket
      .find({
        metadata: req.params.id
      })
      .toArray((err, files) => {
        if (!files || files.length === 0) {
            res.status(404).send({result:"ERROR",error_reason:"Dosya bulunamadı."});
        }
    res.set('Content-Disposition', 'attachment; filename=\"'+files[0].filename+'\"');      
    bucket.openDownloadStreamByName(files[0].filename). 
    on('error', function(error) {
        if(error.code=="ENOENT"){
          res.status(404).send({result:"ERROR",error_reason:"Dosya bulunamadı."});
        }
        res.status(500).send({result:"ERROR",error_reason:error.message});
      }).
    on('finish', function() {
        console.log('done!');
        res.status(200).send({result:"OK"});
      }).pipe(res); 
      });
  });


  app.get("/generateURL",(req,res)=>{
    var guid =guID.create();
    guid=""+guid;
    genurl =serverURL+"upload/"+guid;
    var myobj = { createTime:new Date(), key:guid, url:genurl};
    db.collection(options.database.mongoUrlCollection).insertOne(myobj, function(err, ress) {
      if (err){
        res.status(500).send({result:"ERROR",error_reason:err.message}); }
      console.log("1 document inserted");
      res.status(200).send({result:"OK",url:genurl,expires:options.insertOptions.expireTime});
    });
  });


  app.get("/",(req,res)=>{
    res.render("list.ejs",{
      server:serverURL
    });
  })

  var sortLength=1;
  var sortDate=-1;
  var sortFilename=1;

  app.get("/:page",(req,res,next)=> {
    var perPage=options.viewOptions.perPageData;
    var page=req.params.page||1;
    var query=req.query;
    var queryString="";
    var queryForDB={};
    var sortForDB={};
   
      if(query.search!=null){
        var s={"filename":new RegExp(query.search)};
        queryForDB=Object.assign({}, queryForDB, s);
        queryString=queryString+"search="+query.search+"&";
      }
      if(query.start!=null){
        var d={"uploadDate":{
          $gte: new Date(query.start),
          $lt: new Date(query.end)
        }};
        console.log(d);
        queryForDB=Object.assign({}, queryForDB, d);
        queryString=queryString+"start="+query.start+"&end="+query.end+"&";
      }

      if(query.len!=null){
        sortLength=parseInt(query.len);
        if(sortLength==2)
          sortLength=-1;
        var s={"length":sortLength};
        sortForDB=Object.assign({},sortForDB,s);
        console.log(sortLength)
        queryString=queryString+"len="+query.len+"&";
      }
      if(query.filename!=null){
        sortFilename=parseInt(query.filename);
        if(sortFilename==2)
          sortFilename=-1;
        var s={"length":sortFilename};
        sortForDB=Object.assign({},sortForDB,s);
        console.log(sortFilename)
        queryString=queryString+"filename="+query.filename+"&";
      }
      if(query.date!=null){
        sortDate=parseInt(query.date);
        if(sortDate==2)
          sortDate=-1;
        var d={"uploadDate":sortDate};
        sortForDB=Object.assign({},sortForDB,d);
        queryString=queryString+"date="+query.date+"&";
      }
      if(queryString.length>1){
        queryString="?"+queryString;
        queryString=queryString.substr(0,queryString.length-1)
        console.log(queryString);
     }
      db.collection("uploads.files").find(queryForDB).count( {}, function(err, result){
        if(err){
            res.status(500).send({result:"ERROR",error_reason:err.message})
        }
        else{    
          bucket
          .find(queryForDB)
          .sort(sortForDB)
          .skip((perPage*page)-perPage)
          .limit(perPage)
          .toArray(function(err,file){
                if(err) return next(err)
                res.render("index.ejs",{
                  rowIndex:(perPage*(page-1))+1,
                  query:queryString,
                  files:file,
                  current:page,
                  pages:Math.ceil(result/perPage),
                  config:serverURL
                });
            })
        }
      })

  });


  app.post("/deleteFile/:_id", (req, res) => {
    bucket.delete(ObjectId(req.params._id), (err, data) => {
      if (err) return res.status(500).send({ result:"ERROR",error_reason: err.message });
      res.redirect("/");
    });
  });


  const port = process.env.PORT||27017;

  if(options.app.tls==1){
    httpsServer.listen(port);
  }
  else{
    app.listen(port);
  }