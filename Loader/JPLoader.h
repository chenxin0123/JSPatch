//
//  JSPatch.h
//  JSPatch
//
//  Created by bang on 15/11/14.
//  Copyright (c) 2015 bang. All rights reserved.
//

#import <Foundation/Foundation.h>

const static NSString *rootUrl = @"";
static NSString *publicKey = @"-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+1xcYsEE+ab/Ame1/HHAgfBRh\nD67I9mBYCiOJqC3lJX5RKFvtOTcF5Sf5Bz3NL/2QWPLu40+yt4EvjZ3HOUAHrVgo\n2Fjo4vpaRoEaEtaccOziPH/ASScOfL+uppNGOa0glTCZLKVZI3Go8zoutr8VDw2d\nNT7rDM/4TvPjwMYd3QIDAQAB\n-----END PUBLIC KEY-----";

typedef void (^JPUpdateCallback)(NSError *error);

typedef enum {
    JPUpdateErrorUnzipFailed = -1001,
    JPUpdateErrorVerifyFailed = -1002,
} JPUpdateError;

/**
 *  JSPatch 脚本需要后台下发，客户端需要一套打包下载/执行的流程，还需要考虑传输过程中安全问题，JPLoader 就是帮你做了这些事情。
 下载执行脚本很简单，这里主要做的事是保证传输过程的安全，JPLoader 包含了一个打包工具 packer.php，用这个工具对脚本文件进行打包，得出打包文件的 MD5，再对这个MD5 值用私钥进行 RSA 加密，把加密后的数据跟脚本文件一起大包发给客户端。JPLoader 里的程序对这个加密数据用私钥进行解密，再计算一遍下发的脚本文件 MD5 值，看解密出来的值跟这边计算出来的值是否一致，一致说明脚本文件从服务器到客户端之间没被第三方篡改过，保证脚本的安全
 */
@interface JPLoader : NSObject
+ (BOOL)run;
+ (void)updateToVersion:(NSInteger)version callback:(JPUpdateCallback)callback;
+ (void)runTestScriptInBundle;
+ (void)setLogger:(void(^)(NSString *log))logger;
+ (NSInteger)currentVersion;
@end