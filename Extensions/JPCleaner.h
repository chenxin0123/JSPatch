//
//  JPReverter.h
//  JSPatchDemo
//
//  Created by bang on 2/4/16.
//  Copyright © 2016 bang. All rights reserved.
//

#import "JPEngine.h"

@interface JPCleaner : JPExtension
/**
 *  把当前所有被 JSPatch 替换的方法恢复原样
 */
+ (void)cleanAll;

/**
 *  只回退某个类
 *
 *  @param className 类名
 */
+ (void)cleanClass:(NSString *)className;
@end
