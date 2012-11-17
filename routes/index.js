var app = require('express').__app,
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    cloudinary = require('cloudinary'),
    filemanager = require('../models').filemanager;


var crumbs = function(req, res, next){
    var crumbs = [];

    var parent = function(id){
        filemanager
            .findOne()
            .where('_id', id)
            .exec(function(err, folder){
                if(folder) {
                    crumbs.push(folder.toObject());
                    parent(folder.parent);
                }else{
                    req.crumbs = crumbs.reverse();
                    next()
                }

            })
    };

    if(req.query.id){
        parent(req.query.id);
    }
    else next();
};

app.get('/files', function(req, res){
    filemanager.find().exec(function(err, docs){
        res.json(err || docs);
    })
});

app.get('/filemanager', [crumbs], function(req, res){
    filemanager.find().where('parent', req.query.id || null).sort({parent: 1, folder: -1}).exec(function(err, docs){
        res.render('filemanager', {title: 'File Manager', crumbs: req.crumbs, files: docs, id: req.query.id});
    });
});

app.post('/filemanager/delete', function(req, res){
    var arr = [];

    if (req.body.id instanceof Array) {
        arr = req.body.id;
    } else {
        arr.push(req.body.id);
    }



    var q = filemanager.where('_id').in(arr);

    q.remove(function(err, docs){
        if(err) res.end(500);
        else res.json(docs);
    })
});

app.post('/filemanager/create/folder', function(req, res){
    var f = new filemanager();
    f.folder = true;
    f.name = req.body.name;
    f.parent = req.body.parent;
    f.save(function(err, doc){
        res.json(err || doc);
    })
});

app.post('/upload', function(req, res){
    var files = [];
    for(var file in req.files){
        if(req.files[file].size)
            files.push(req.files[file]);
    }

    async.forEach(files, function(file, callback){
        cloudinary.uploader.upload(file.path, function(result) {
            result.name = file.name;
            result.size = file.size;
            result.folder = false;
            result.parent = req.query.id || null;

            var f = new filemanager(result);
            f.save(callback);
        });
    }, function(err){
        res.json(err || {jsonrpc : '2.0', result : null, id : 'id'});
    });
});