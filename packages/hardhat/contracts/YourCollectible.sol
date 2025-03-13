// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract YourCollectible is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    ERC721Royalty,
    Ownable,
    ReentrancyGuard
{
    using Counters for Counters.Counter;

    Counters.Counter public tokenIdCounter;
    uint256 public totalFeesCollected;
//===============================结构体、映射、事件=================================
    struct NftItem {
        uint256 tokenId;
        uint256 price;
        address payable seller;
        bool isListed;  // 标识是否已经上架
        string tokenUri;
        bool isAuction; // 标识是否处于拍卖状态
    }

    struct TradeHistory {
        address seller;
        address buyer;
        uint256 price;
        uint256 timestamp;
    }
    // 拍卖信息结构体
    struct Auction {
        uint256 tokenId;         // NFT的ID
        uint256 startingPrice;   // 拍卖起始价格
        uint256 highestBid;      // 当前最高出价
        address highestBidder;   // 当前最高出价者
        uint256 auctionEndTime;  // 拍卖结束时间
        bool isAuctionActive;    // 是否处于拍卖状态
        address auctionOwner;   // 将发起者地址保存
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }
    mapping(uint256 => Bid[]) private bidHistory;
    mapping(uint256 => NftItem) private _idToNftItem;
    mapping(uint256 => Bid[]) private _idToBidHistory; // 独立存储每个拍卖的出价历史
    // 拍卖信息映射
    mapping(uint256 => Auction) private auctions;
    // 存储所有正在拍卖的tokenId
    uint256[] private allAuctionedTokenIds; 

    mapping(string => bool) private _usedTokenURIs;
    uint256[] private _listedTokenIds;
    mapping(uint256 => uint256) private _tokenIdToListedIndex;
    mapping(uint256 => TradeHistory[]) private _tradeHistory;

    mapping(address => uint256) public royaltyEarnings; 
    mapping(uint256 => uint256) public tokenRoyaltyEarnings; 

    uint256 public listingFeePercentage = 250; // 2.5%
    uint256 public constant MAX_LISTING_FEE_PERCENTAGE = 1000; // 最多10%

    event NftListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NftUnlisted(uint256 indexed tokenId, address indexed seller);
    event NftPurchased(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingFeePercentageUpdated(uint256 newListingFeePercentage);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    event FeesReceived(address indexed sender, uint256 amount);
    event BaseURIUpdated(string newBaseURI);
    event NftMinted(uint256 indexed tokenId, address indexed owner, string tokenUri);
    event RoyaltyEarningsUpdated(address indexed receiver, uint256 amount);
    event AuctionStarted(uint256 indexed tokenId, uint256 startingPrice, uint256 auctionEndTime);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 winningBid);
    event NewBidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount, uint256 timestamp);
    event AuctionStopped(uint256 indexed tokenId, address indexed owner);


    event NftBurned(uint256 indexed tokenId, address indexed owner);
    // 新增提醒版税费用事件
    event RoyaltyFeeNotification(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed royaltyReceiver,
        uint96 royaltyPercentage,
        uint256 royaltyAmount
    );

    constructor() ERC721("YourCollectible", "YCB") {}

    // 设置基础URI
    function _baseURI() internal pure override returns (string memory) {
        return "https://black-deliberate-penguin-271.mypinata.cloud/ipfs/";
    }
//=======================铸造、销毁、购买、版税、交易历史、下架=====================
    // 铸造NFT
    function mintItem(address to, string memory uri, address royaltyReceiver, uint96 feeNumerator) public returns (uint256) {
        // 确保版税不大于1000（10%）
        require(feeNumerator <= 1000, "Royalty fee cannot exceed 10%");

        tokenIdCounter.increment();
        uint256 tokenId = tokenIdCounter.current();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        

        // 设置版税接收者和比例
        _setTokenRoyalty(tokenId, royaltyReceiver, feeNumerator);

        _idToNftItem[tokenId] = NftItem({
            tokenId: tokenId,
            price: 0,
            seller: payable(address(0)),
            isListed: false,
            tokenUri: uri,
            isAuction: false 
        });

        emit NftUnlisted(tokenId, address(0));
        return tokenId;
    }

    // 批量铸造NFT
    function mintBatch(address to, string[] memory uris, address royaltyReceiver, uint96 feeNumerator) public returns (uint256[] memory) {
        require(uris.length <= 20, "Exceeded max batch size of 20");  // 限制批量铸造的最大数量为20
        uint256[] memory tokenIds = new uint256[](uris.length);

        for (uint256 i = 0; i < uris.length; i++) {
            // 调用单独的铸造函数 mintItem
            uint256 tokenId = mintItem(to, uris[i], royaltyReceiver, feeNumerator);
            tokenIds[i] = tokenId;  // 记录每个tokenId
        }

        return tokenIds;  // 返回铸造的所有tokenId
    }
    
    // 销毁NFT
    function burn(uint256 tokenId) external {
        // 只能NFT的拥有者销毁自己的NFT
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this NFT");

        // 调用父合约的 _burn 函数销毁NFT
        _burn(tokenId);

        // 触发销毁事件
        emit NftBurned(tokenId, msg.sender);
    }

    // 下架NFT
    function unlistNft(uint256 tokenId) external nonReentrant {
        NftItem storage item = _idToNftItem[tokenId];
        require(item.isListed, "Item is not listed");
        require(item.seller == msg.sender, "You are not the seller");

        _transfer(address(this), msg.sender, tokenId);

        item.isListed = false;
        item.price = 0;
        item.seller = payable(address(0));

        _removeFromListed(tokenId);

        emit NftUnlisted(tokenId, msg.sender);
    }

    // 购买NFT函数
    function purchaseNft(uint256 tokenId) external payable nonReentrant {
        NftItem storage item = _idToNftItem[tokenId];
        require(item.isListed, "Item is not listed for sale");
        require(msg.value == item.price, "Payment must be exactly the price");
        require(item.seller != msg.sender, "You are the seller");

        address payable seller = item.seller;
        uint256 price = item.price;

        item.isListed = false;
        item.seller = payable(msg.sender);
        item.price = 0;

        _removeFromListed(tokenId);

        // 获取版税信息，royaltyReceiver是版税接收者，royaltyAmount是版税金额
        (address royaltyReceiver, uint256 royaltyAmount) = royaltyInfo(tokenId, price);

        if (royaltyReceiver != address(0) && royaltyAmount > 0) {
            // 向版税接收者转账
            (bool royaltySuccess, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltySuccess, "Transfer to royalty receiver failed");
        }

        // 向卖家转账剩余金额
        uint256 sellerAmount = price - royaltyAmount;
        (bool sellerSuccess, ) = seller.call{value: sellerAmount}("");
        require(sellerSuccess, "Transfer to seller failed");

        royaltyEarnings[royaltyReceiver] += royaltyAmount;
        recordRoyaltyEarnings(tokenId, royaltyAmount);

        _transfer(address(this), msg.sender, tokenId);

        _tradeHistory[tokenId].push(TradeHistory({
            seller: seller,
            buyer: msg.sender,
            price: price,
            timestamp: block.timestamp
        }));

        emit NftPurchased(tokenId, seller, msg.sender, price);
    }

    // 记录版税收入
    function recordRoyaltyEarnings(uint256 tokenId, uint256 amount) internal {
        (address royaltyReceiver, ) = royaltyInfo(tokenId, 10000); // 获取版税接收者地址
        royaltyEarnings[royaltyReceiver] += amount;
        tokenRoyaltyEarnings[tokenId] += amount;
    }
    // 获取单个NFT的版税收入
    function getTokenRoyaltyEarnings(uint256 tokenId) external view returns (uint256) {
        return tokenRoyaltyEarnings[tokenId];
    }
    
    function checkRoyaltyEarnings(address account) external view returns (uint256) {
        return royaltyEarnings[account];
    }

    // 获取NFT的交易历史
    function getTradeHistory(uint256 tokenId) public view returns (TradeHistory[] memory) {
        return _tradeHistory[tokenId];
    }

    // 获取NFT信息
    function getNftItem(uint256 tokenId) public view returns (NftItem memory) {
        return _idToNftItem[tokenId];
    }
//======================================上架=======================================
    // 上架NFT函数
    function placeNftOnSale(uint256 tokenId, uint256 price) external payable nonReentrant {
        require(price > 0, "Price must be at least 1 wei");
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this NFT");
        require(!_idToNftItem[tokenId].isListed, "Item is already on sale");
        require(msg.value == calculateListingFee(price), "Incorrect listing fee");

        // 获取版税接收者及比例
        (address royaltyReceiver, uint256 royaltyPercentage) = royaltyInfo(tokenId, price);

        // 如果版税接收者和卖家不同，计算版税金额并发出提醒
        if (msg.sender != royaltyReceiver) {
            uint256 royaltyAmount = (price * royaltyPercentage) / 10000;
            emit RoyaltyFeeNotification(tokenId, msg.sender, royaltyReceiver, uint96(royaltyPercentage), royaltyAmount);
        }

        _transfer(msg.sender, address(this), tokenId);

        _idToNftItem[tokenId] = NftItem({
            tokenId: tokenId,
            price: price,
            seller: payable(msg.sender),
            isListed: true,
            tokenUri: tokenURI(tokenId),
            isAuction: false 
        });

        _listedTokenIds.push(tokenId);
        _tokenIdToListedIndex[tokenId] = _listedTokenIds.length - 1;

        totalFeesCollected += msg.value;

        emit NftListed(tokenId, msg.sender, price);
    }

    // 设置上架费比例
    function setListingFeePercentage(uint256 _newListingFeePercentage) external onlyOwner {
        require(_newListingFeePercentage <= MAX_LISTING_FEE_PERCENTAGE, "Listing fee cannot exceed 10%");
        listingFeePercentage = _newListingFeePercentage;
        emit ListingFeePercentageUpdated(_newListingFeePercentage);
    }

    // 获取上架NFT的数量
    function getListedItemsCount() external view returns (uint256) {
        return _listedTokenIds.length;
    }

    // 从上架列表中移除NFT
    function _removeFromListed(uint256 tokenId) internal {
        uint256 index = _tokenIdToListedIndex[tokenId];
        uint256 lastTokenId = _listedTokenIds[_listedTokenIds.length - 1];

        _listedTokenIds[index] = lastTokenId;
        _tokenIdToListedIndex[lastTokenId] = index;

        _listedTokenIds.pop();
        delete _tokenIdToListedIndex[tokenId];
    }

    // 获取所有已上架的NFT
    function getAllListedNfts() external view returns (NftItem[] memory) {
        uint256 totalListed = _listedTokenIds.length;
        NftItem[] memory items = new NftItem[](totalListed);
        for (uint256 i = 0; i < totalListed; i++) {
            uint256 tokenId = _listedTokenIds[i];
            items[i] = _idToNftItem[tokenId];
        }
        return items;
    }

    // 计算上架费用
    function calculateListingFee(uint256 price) public view returns (uint256) {
        return (price * listingFeePercentage) / 10000; // 以千分之一计算
    } 
//======================================空投=======================================
    bytes32 public merkleRoot;
    mapping(address => bool) public hasClaimed;
    event Claimed(address indexed claimant, uint256 tokenId);

    // 仅管理员可以调用批量空投铸造NFT
    function mintAirdropBatch(string[] memory uris, uint96 feeNumerator) public onlyOwner returns (uint256[] memory) {
        require(uris.length <= 20, "Exceeded max batch size of 20");  // 限制批量铸造的最大数量为20

        uint256[] memory tokenIds = new uint256[](uris.length);

        for (uint256 i = 0; i < uris.length; i++) {
            // 调用单独的铸造函数 mintItem，将 NFT 铸造给合约地址
            uint256 tokenId = mintItem(msg.sender, uris[i], msg.sender, feeNumerator);  // 修改为合约地址
            tokenIds[i] = tokenId;  // 记录每个 tokenId
        }

        return tokenIds;  // 返回铸造的所有 tokenId
    }

    // 只允许管理员调用，设置 Merkle 根
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    // 由管理员转移 NFT 给用户的 claimNFT 函数
    function claimNFT(bytes32[] calldata merkleProof, uint256 tokenId) external {
        require(!hasClaimed[msg.sender], "You have already claimed your NFT");

        // 计算 leaf 节点，包含地址和 Token ID
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, tokenId));

        // 验证 Merkle Proof
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Invalid proof");

        // 标记该用户已领取
        hasClaimed[msg.sender] = true;

        // 由管理员（合约所有者）转移 NFT
        _safeTransfer(owner(), msg.sender, tokenId, "");

        // 触发领取事件
        emit Claimed(msg.sender, tokenId);
    }
//====================================转赠NFT======================================
    address public airdropSender;
    event AirdropClaimed(address indexed user, uint256 tokenId);

    // 领取空投
    function claimAirdrop(uint256 tokenId) external {
        // 检查是否已经领取过空投
        require(!hasClaimed[msg.sender], "Already claimed");

        // 更新领取状态
        hasClaimed[msg.sender] = true;

        // 调用 _transfer 函数进行 NFT 转账
        _transfer(airdropSender, msg.sender, tokenId);

        // 触发空投事件
        emit AirdropClaimed(msg.sender, tokenId);
    }
//======================================拍卖=======================================
    // 拍卖延长时间
    uint256 public auctionTimeExtension = 1 minutes; 
    // 最后十秒内加价才延长拍卖时间
    uint256 public timeBuffer = 10 seconds; 

    // 声明事件
    event AuctionTimeExtensionUpdated(uint256 indexed tokenId, uint256 newExtension);
    event TimeBufferUpdated(uint256 newBuffer);
    event AuctionBidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 bidAmount, uint256 auctionEndTime);

    // 设置拍卖延长时间
    function setAuctionTimeExtension(uint256 tokenId) external {
        Auction storage auction = auctions[tokenId];
        require(auction.isAuctionActive, "Auction is not active");
        require(block.timestamp < auction.auctionEndTime, "Auction has already ended");

        uint256 remainingTime = auction.auctionEndTime - block.timestamp;
        require(remainingTime <= timeBuffer, "Auction end time too long to extend");

        // 使用默认的 auctionTimeExtension 延长拍卖时间
        auction.auctionEndTime += auctionTimeExtension;
        emit AuctionTimeExtensionUpdated(tokenId, auctionTimeExtension);
    }

    // 设置最后延长的时间阈值，只有合约拥有者才能调用
    function setTimeBuffer(uint256 buffer) external onlyOwner {
        timeBuffer = buffer;
        emit TimeBufferUpdated(buffer);
    }
    //创建拍卖
    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 duration) external nonReentrant {
        require(!auctions[tokenId].isAuctionActive, "Auction already active");

        // 托管 NFT
        _transfer(msg.sender, address(this), tokenId);

        // 初始化拍卖信息
        auctions[tokenId] = Auction({
            tokenId: tokenId,
            startingPrice: startingPrice,
            highestBid: 0,
            highestBidder: address(0),
            auctionEndTime: block.timestamp + duration,
            isAuctionActive: true,
            auctionOwner: msg.sender // 设置拍卖发起者
        });

        // 确保 tokenId 被记录到 allAuctionedTokenIds
        allAuctionedTokenIds.push(tokenId);

        emit AuctionStarted(tokenId, startingPrice, block.timestamp + duration);
    }
    // 出价函数
    function placeBid(uint256 tokenId) external payable nonReentrant {
        Auction storage auction = auctions[tokenId];

        // 检查拍卖是否激活且未结束
        require(auction.isAuctionActive, "Auction is not active");
        require(block.timestamp < auction.auctionEndTime, "Auction has ended");

        // 出价必须高于当前最高出价
        require(msg.value > auction.highestBid, "Bid is not high enough");

        // 获取剩余时间
        uint256 remainingTime = auction.auctionEndTime - block.timestamp;

        // 如果剩余时间小于等于 timeBuffer（例如10秒），则延长拍卖时间
        if (remainingTime <= timeBuffer) {
            auction.auctionEndTime += auctionTimeExtension; // 延长拍卖时间
            emit AuctionTimeExtensionUpdated(tokenId, auctionTimeExtension); // 触发事件
        }

        // 如果有之前的出价，退还之前的最高出价者
        if (auction.highestBid > 0) {
            (bool refunded, ) = payable(auction.highestBidder).call{value: auction.highestBid}("");
            require(refunded, "Failed to refund previous bidder");
        }

        // 更新最高出价和竞拍者
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        // 记录出价历史
        bidHistory[tokenId].push(Bid({
            bidder: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));

        // 触发出价事件
        emit AuctionBidPlaced(tokenId, msg.sender, msg.value, auction.auctionEndTime);
    }
    modifier onlyAuctionOwner(uint256 tokenId) {
        require(msg.sender == auctions[tokenId].auctionOwner, "You are not the owner of this auction");
        _;
    }
    // 查看当前拍卖信息
    function getAuctionInfo(uint256 tokenId) public view returns (Auction memory) {
        require(auctions[tokenId].auctionEndTime > block.timestamp, "Auction has ended");
        return auctions[tokenId];
    }
    // 获取所有拍卖中的NFT
    function getAllAuctionedNfts() external view returns (Auction[] memory) {
        uint256 activeCount = 0;

        // 计算所有活跃拍卖的数量
        for (uint256 i = 0; i < allAuctionedTokenIds.length; i++) {
            if (auctions[allAuctionedTokenIds[i]].isAuctionActive) {
                activeCount++;
            }
        }

        // 返回所有活跃拍卖的NFT
        Auction[] memory activeAuctions = new Auction[](activeCount);
        uint256 count = 0;
        for (uint256 i = 0; i < allAuctionedTokenIds.length; i++) {
            uint256 tokenId = allAuctionedTokenIds[i];
            if (auctions[tokenId].isAuctionActive) {
                activeAuctions[count] = auctions[tokenId];
                count++;
            }
        }

        return activeAuctions;
    }
    // 获取出价历史
    function getBidHistory(uint256 tokenId) external view returns (Bid[] memory) {
        require(auctions[tokenId].isAuctionActive, "Auction is not active");
        return bidHistory[tokenId];
    }

    // 获取拍卖发起者地址
    function getAuctionOwner(uint256 tokenId) external view returns (address) {
        return auctions[tokenId].auctionOwner;  // 直接返回结构体中的auctionOwner字段
    }

    // 结束拍卖
    function endAuction(uint256 tokenId) external nonReentrant {
        Auction storage auction = auctions[tokenId];

        // 确保拍卖是进行中的
        require(auction.isAuctionActive, "Auction is not active");

        // 确保拍卖时间已到
        require(block.timestamp >= auction.auctionEndTime, "Auction has not ended yet");

        auction.isAuctionActive = false;

        // 获取版税接收者及版税比例
        (address royaltyReceiver, uint256 royaltyPercentage) = royaltyInfo(tokenId, auction.highestBid);

        // 如果有最高出价者，执行转移NFT和支付流程
        if (auction.highestBidder != address(0)) {
            // 转移NFT到最高出价者
            _transfer(address(this), auction.highestBidder, tokenId);

            uint256 royaltyAmount = 0;

            // 如果版税接收者和卖家不同，则支付版税
            address seller = ownerOf(tokenId);  // 获取卖家的地址
            if (royaltyReceiver != seller) {
                royaltyAmount = (auction.highestBid * royaltyPercentage) / 10000;
                (bool paidRoyalty, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
                require(paidRoyalty, "Payment of royalty failed");
            }

            // 支付剩余金额给卖家
            uint256 sellerAmount = auction.highestBid - royaltyAmount;
            (bool paid, ) = payable(seller).call{value: sellerAmount}("");
            require(paid, "Payment to seller failed");

            emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);

            // 如果支付了版税，发出通知
            if (royaltyAmount > 0) {
                emit RoyaltyFeeNotification(tokenId, seller, royaltyReceiver, uint96(royaltyPercentage), royaltyAmount);
            }
        } else {
            // 如果没有出价者，退回NFT给卖家
           address auctionOwner = auctions[tokenId].auctionOwner;
            _transfer(address(this), auctionOwner, tokenId);
            emit AuctionEnded(tokenId, address(0), 0);
        }

        // 从 allAuctionedTokenIds 中移除该 tokenId
        for (uint256 i = 0; i < allAuctionedTokenIds.length; i++) {
            if (allAuctionedTokenIds[i] == tokenId) {
                allAuctionedTokenIds[i] = allAuctionedTokenIds[allAuctionedTokenIds.length - 1];
                allAuctionedTokenIds.pop();
                break;
            }
        }

        // 删除拍卖记录
        delete auctions[tokenId];
    }

    // 停止拍卖
    function stopAuctionWithBids(uint256 tokenId) public {
        address auctionOwner = auctions[tokenId].auctionOwner;  // 获取拍卖发起者地址

        require(msg.sender == auctionOwner, "Caller is not the auction owner");  // 确保调用者是拍卖的拥有者
        require(auctions[tokenId].isAuctionActive, "Auction is not active");

        if (auctions[tokenId].highestBid > 0) {
            // 将 NFT 转移给最高出价者
            _transfer(address(this), auctions[tokenId].highestBidder, tokenId);

            // 支付最高出价金额给拍卖者
            (bool success, ) = payable(auctionOwner).call{value: auctions[tokenId].highestBid}("");  // 支付给拍卖拥有者
            require(success, "Payment failed");
        } else {
            // 无人出价时，退回 NFT
            _transfer(address(this), msg.sender, tokenId);
        }

        auctions[tokenId].isAuctionActive = false;  // 标记拍卖已结束

        // 从 allAuctionedTokenIds 中移除该 tokenId
        for (uint256 i = 0; i < allAuctionedTokenIds.length; i++) {
            if (allAuctionedTokenIds[i] == tokenId) {
                allAuctionedTokenIds[i] = allAuctionedTokenIds[allAuctionedTokenIds.length - 1];
                allAuctionedTokenIds.pop();
                break;
            }
        }

        // 删除拍卖记录
        delete auctions[tokenId];

        emit AuctionStopped(tokenId, msg.sender);
    }
//======================================盲盒=======================================
    Counters.Counter private _boxIdCounter; // 盲盒ID计数器
    mapping(uint256 => Box) private _idToBox; // 盲盒信息映射
    mapping(address => uint256[]) private _userBoxes; // 用户拥有的盲盒
    struct Box {
        uint256 boxId; // 盲盒的唯一标识符
        uint256 price; // 盲盒的价格
        address owner; // 盲盒的拥有者（合约地址）
        uint256[] tokenIds; // 盲盒中包含的NFT ID
        bool isPurchased; // 标记盲盒是否已被购买
    }
    // 事件
    event BoxCreated(uint256 indexed boxId, address indexed owner, uint256 price, uint256[] tokenIds);
    event BoxPurchased(uint256 indexed boxId, address indexed buyer, uint256[] tokenIds);

    // 创建盲盒
    function createBox(uint256[] calldata tokenIds, uint256 price) external nonReentrant{
        require(tokenIds.length > 0, "At least one NFT is required to create a box");
        require(price > 0, "Price must be greater than 0");

        // 验证用户是否拥有这些NFT并将它们转移到合约
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(ownerOf(tokenIds[i]) == msg.sender, "You do not own one of these NFTs");
            _transfer(msg.sender, address(this), tokenIds[i]);  // 将NFT转移到合约地址
        }

        // 增加盲盒ID
        _boxIdCounter.increment();
        uint256 boxId = _boxIdCounter.current();

        // 创建盲盒
        _idToBox[boxId] = Box({
            boxId: boxId,
            price: price,
            owner: address(this), // 合约地址作为盲盒的拥有者
            tokenIds: tokenIds,
            isPurchased: false
        });

        // 记录该用户创建的盲盒
        _userBoxes[msg.sender].push(boxId);

        emit BoxCreated(boxId, address(this), price, tokenIds);
    }
    // 购买盲盒
    function purchaseBox(uint256 boxId) external payable nonReentrant{
        Box storage box = _idToBox[boxId];
        require(!box.isPurchased, "Box has already been purchased");
        require(msg.value == box.price, "Incorrect value sent");

        // 标记盲盒为已购买
        box.isPurchased = true;

        // 将盲盒中的NFT转移到购买者
        for (uint256 i = 0; i < box.tokenIds.length; i++) {
            uint256 tokenId = box.tokenIds[i];
            _transfer(address(this), msg.sender, tokenId);
        }

        // 向盲盒的创建者支付购买金额
        (bool success, ) = payable(ownerOf(box.tokenIds[0])).call{value: box.price}(""); // 向创建者支付
        require(success, "Transfer to owner failed");

        emit BoxPurchased(boxId, msg.sender, box.tokenIds);
    }
    // 获取所有盲盒的详细信息
    function getAllBoxesInfo() external view returns (Box[] memory) {
        uint256 totalBoxes = _boxIdCounter.current();
        Box[] memory allBoxes = new Box[](totalBoxes);

        for (uint256 i = 0; i < totalBoxes; i++) {
            allBoxes[i] = _idToBox[i + 1]; // 盲盒ID从1开始
        }

        return allBoxes;
    }
//====================================收藏NFT======================================
    // 存储用户是否收藏某个NFT的映射
    mapping(address => mapping(uint256 => bool)) private _favorites;

    // 添加收藏
    function addToFavorites(uint256 tokenId) external {
        _favorites[msg.sender][tokenId] = true;
    }
    // 查询某个用户是否收藏了指定的NFT
    function isFavorite(uint256 tokenId) external view returns (bool) {
        return _favorites[msg.sender][tokenId];
    }

    // 移除收藏
    function removeFromFavorites(uint256 tokenId) external {
        _favorites[msg.sender][tokenId] = false;
    }   

    // 获取所有盲盒的ID
    function getAllBoxIds() external view returns (uint256[] memory) {
        uint256 totalBoxes = _boxIdCounter.current();
        uint256[] memory allBoxIds = new uint256[](totalBoxes);

        for (uint256 i = 0; i < totalBoxes; i++) {
            allBoxIds[i] = i + 1; // 盲盒ID从1开始
        }

        return allBoxIds;
    } 
//====================================函数重写=====================================
     // 重写必要的ERC721函数
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    // 重写 _burn 函数，调用每个父合约的 _burn
    function _burn(uint256 tokenId) internal override(ERC721, ERC721Royalty, ERC721URIStorage) {
        super._burn(tokenId); // 只调用一次父合约的 _burn
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage,ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
