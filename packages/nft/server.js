const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

// 使用 body-parser 解析请求体
app.use(bodyParser.json());
app.use(cors());

// 创建数据库连接池
const pool = mysql.createPool({
  host: 'localhost',    // 数据库主机
  user: 'root',         // 数据库用户名
  password: '123456',   // 数据库密码
  database: 'nft',      // 数据库名
});

// 处理前端发送的保存 NFT 数据请求
app.post('/saveNFT', (req, res) => {
  const { tokenId, price, sellerAddress, tokenUri, isListed, isAuction } = req.body;

  console.log("收到的请求数据：", req.body);

  // 检查必需的字段
  if (!tokenId || tokenId === null || tokenId === undefined) {
    console.error("缺少 tokenId");
    return res.status(400).json({ error: "Missing required field: tokenId" });
  }

  if (!sellerAddress || sellerAddress === null || sellerAddress === undefined || sellerAddress.trim() === "") {
    console.error("缺少 sellerAddress");
    return res.status(400).json({ error: "Missing required field: sellerAddress" });
  }

  if (!tokenUri || tokenUri === null || tokenUri === undefined || tokenUri.trim() === "") {
    console.error("缺少 tokenUri");
    return res.status(400).json({ error: "Missing required field: tokenUri" });
  }

  console.log("插入数据库的数据：", { tokenId, price, sellerAddress, tokenUri, isListed, isAuction });

  // 执行 SQL 插入操作，将 NFT 数据保存到数据库
  const query = `INSERT INTO nfts (token_id, price, seller_address, is_listed, token_uri, is_auction) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

  pool.query(query, [tokenId, price, sellerAddress, isListed, tokenUri, isAuction], (err, result) => {
    if (err) {
      console.error("插入数据库时出错:", err);
      return res.status(500).json({ error: "Database error" });
    }
    // 如果插入成功，返回成功消息
    console.log("NFT 保存成功, 插入 ID:", result.insertId);
    res.status(200).json({ message: "NFT saved successfully", nftId: result.insertId });
  });
});

// 处理举报请求
app.post('/report', (req, res) => {
  const { userAddress, nftTokenId, reason } = req.body;

  if (!userAddress || !nftTokenId || !reason) {
    return res.status(400).json({ error: "Missing userAddress, nftTokenId, or reason" });
  }

  // 插入举报信息
  const query = `INSERT INTO reports (user_address, nft_token_id, reason) 
                 VALUES (?, ?, ?)`;

  pool.query(query, [userAddress, nftTokenId, reason], (err, result) => {
    if (err) {
      console.error("插入举报时出错:", err);
      return res.status(500).json({ error: "Database error" });
    }
    // 如果举报成功
    res.status(200).json({ message: "NFT reported successfully" });
  });
});
// 处理添加收藏请求
app.post('/addToFavorites', (req, res) => {
  const { userAddress, nftTokenId } = req.body;

  // 校验必填字段是否存在
  if (!userAddress || !nftTokenId) {
    return res.status(400).json({ error: "Missing userAddress or nftTokenId" });
  }

  // 插入收藏信息的 SQL 查询
  const query = `INSERT INTO favorites (user_address, nft_token_id) 
                 VALUES (?, ?)`;

  pool.query(query, [userAddress, nftTokenId], (err, result) => {
    if (err) {
      console.error("插入收藏时出错:", err.message); // 输出更详细的错误信息
      return res.status(500).json({ error: "Database error", details: err.message });
    }

    // 如果收藏成功
    res.status(200).json({ message: "NFT added to favorites successfully" });
  });
});
// 处理移除收藏请求
app.post('/removeFromFavorites', (req, res) => {
  const { userAddress, nftTokenId } = req.body;

  // 校验必填字段是否存在
  if (!userAddress || !nftTokenId) {
    return res.status(400).json({ error: "Missing userAddress or nftTokenId" });
  }

  // 删除收藏信息的 SQL 查询
  const query = `DELETE FROM favorites WHERE user_address = ? AND nft_token_id = ?`;

  pool.query(query, [userAddress, nftTokenId], (err, result) => {
    if (err) {
      console.error("移除收藏时出错:", err.message); // 输出更详细的错误信息
      return res.status(500).json({ error: "Database error", details: err.message });
    }

    // 如果移除成功
    if (result.affectedRows === 0) {
      // 如果没有记录被删除，可能是因为该收藏不存在
      return res.status(404).json({ error: "NFT not found in favorites" });
    }

    res.status(200).json({ message: "NFT removed from favorites successfully" });
  });
});
// 处理保存 Merkle Proof 的请求
app.post('/saveMerkleProof', (req, res) => {
  const { proofs } = req.body;

  // 校验是否有 proofs 数据
  if (!proofs) {
    return res.status(400).json({ message: 'Proofs 不能为空' });
  }

  console.log("接收到的 Proofs 数据:", proofs); // 打印接收到的数据

  // 遍历并存储 Proof 数据
  for (const [key, proof] of Object.entries(proofs)) {
    const [address, tokenId] = key.split('-');

    // 先检查数据库中是否已存在相同的 proof 数据
    const checkQuery = `SELECT * FROM merkle_proofs WHERE user_address = ? AND token_id = ?`;

    pool.query(checkQuery, [address, tokenId], (err, result) => {
      if (err) {
        console.error("检查数据是否存在时出错:", err.message);
        return res.status(500).json({ message: '检查数据时出错', details: err.message });
      }

      if (result.length > 0) {
        // 如果数据库中已有相同的记录，则跳过插入
        console.log(`Proof for ${address}-${tokenId} already exists, skipping...`);
        return;
      }

      // 插入数据到数据库
      const query = `INSERT INTO merkle_proofs (user_address, token_id, proof, leaf_hash) 
                     VALUES (?, ?, ?, ?)`;

      // 假设 leaf_hash 是 proof 数组的第一个元素
      const leafHash = proof[0];  // 这里假设 proof 数组的第一个元素是叶子哈希

      // 直接插入 proof 为字符串
      pool.query(query, [address, tokenId, JSON.stringify(proof), leafHash], (err, result) => {
        if (err) {
          console.error("存储 Proof 时发生错误:", err.message);
          return res.status(500).json({ message: '存储 Proof 时发生错误', details: err.message });
        }

        console.log("插入数据库结果:", result); // 打印插入结果
      });
    });
  }

  res.status(200).json({ message: 'Proofs 保存成功' });
});

// 获取 Merkle Proofs
app.get('/getMerkleProofs', (req, res) => {
  const { address, tokenId } = req.query;

  // 校验必填字段是否存在
  if (!address || !tokenId) {
    return res.status(400).json({ error: "Missing address or tokenId" });
  }

  // SQL 查询语句
  const query = `SELECT proof FROM merkle_proofs WHERE user_address = ? AND token_id = ?`;

  // 执行查询
  pool.query(query, [address, tokenId], (err, result) => {
    if (err) {
      console.error("读取 Merkle Proof 时出错:", err.message);
      return res.status(500).json({ error: "Database error", details: err.message });
    }

    if (result.length === 0) {
      // 如果查询结果为空，表示没有找到对应的数据
      return res.status(404).json({ error: "Proof not found" });
    }

    // 直接返回 proof 字符串
    res.status(200).json({ proof: result[0].proof });
  });
});


// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}...`);
});
