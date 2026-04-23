const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001; // 使用 3001 端口，避免和你的跳链项目冲突

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 配置 multer 用于处理文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 处理中文文件名乱码问题
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        // 为了避免重名，在文件名前加上时间戳
        cb(null, Date.now() + '-' + originalName);
    }
});

const upload = multer({ storage: storage });

// API: 获取文件列表
app.get('/api/files', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: '无法读取文件列表' });
        
        const fileInfos = files.map(file => {
            const stats = fs.statSync(path.join(uploadDir, file));
            return {
                name: file,
                // 去除时间戳前缀，提取原始文件名用于展示
                originalName: file.substring(file.indexOf('-') + 1),
                size: stats.size,
                time: stats.mtime
            };
        });
        
        // 按时间倒序排列，最新上传的在最前面
        fileInfos.sort((a, b) => b.time - a.time);
        res.json(fileInfos);
    });
});

// API: 上传文件
app.post('/api/upload', upload.array('files'), (req, res) => {
    res.json({ message: '文件上传成功', files: req.files });
});

// API: 下载文件
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const file = path.join(uploadDir, filename);
    
    if (fs.existsSync(file)) {
        // 提取去除了时间戳的原始文件名作为下载的默认名字
        const originalName = filename.substring(filename.indexOf('-') + 1);
        res.download(file, originalName);
    } else {
        res.status(404).send('文件不存在');
    }
});

// API: 删除文件
app.delete('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const file = path.join(uploadDir, filename);
    
    if (fs.existsSync(file)) {
        fs.unlink(file, (err) => {
            if (err) return res.status(500).json({ error: '删除失败' });
            res.json({ message: '文件删除成功' });
        });
    } else {
        res.status(404).json({ error: '文件不存在' });
    }
});

app.listen(PORT, () => {
    console.log(`个人云盘服务已启动: http://localhost:${PORT}`);
});
