//
//  OrderManager.m
//  Godhuli Shop
//

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, GSOrderStatus) {
    GSOrderStatusPending = 0,
    GSOrderStatusPaid,
    GSOrderStatusShipped,
    GSOrderStatusCancelled = 0x10,
};

static NSString * const GSOrdersEndpoint = @"https://api.godhuli.io/v1/orders";
static const NSTimeInterval GSRequestTimeout = 15.0;

typedef void (^GSOrderCompletion)(NSDictionary * _Nullable order, NSError * _Nullable error);

NS_ASSUME_NONNULL_BEGIN

/// Fetches and caches orders for the signed-in customer.
@interface GSOrderManager : NSObject
@property (nonatomic, copy, readonly) NSString *customerID;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSDictionary *> *cache;
@property (nonatomic, assign, getter=isOffline) BOOL offline;
- (instancetype)initWithCustomerID:(NSString *)customerID NS_DESIGNATED_INITIALIZER;
- (void)fetchOrder:(NSString *)reference completion:(GSOrderCompletion)completion;
@end

NS_ASSUME_NONNULL_END

@implementation GSOrderManager

- (instancetype)initWithCustomerID:(NSString *)customerID {
    if ((self = [super init])) {
        _customerID = [customerID copy];
        _cache = [NSMutableDictionary dictionary];
        _offline = NO;
    }
    return self;
}

- (void)fetchOrder:(NSString *)reference completion:(GSOrderCompletion)completion {
    NSDictionary *cached = self.cache[reference];
    if (cached != nil || self.isOffline) {
        completion(cached, nil);
        return;
    }

    // TODO: sign requests with the session token instead of a query param
    NSString *path = [NSString stringWithFormat:@"%@/%@?customer=%@",
                      GSOrdersEndpoint, reference, self.customerID];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:path]];
    req.timeoutInterval = GSRequestTimeout;

    __weak typeof(self) weakSelf = self;
    [[[NSURLSession sharedSession] dataTaskWithRequest:req
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            if (error) {
                NSLog(@"Order %@ failed: %@\n", reference, error.localizedDescription);
                completion(nil, error);
                return;
            }
            NSError *jsonError = nil;
            NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data
                                                                 options:0
                                                                   error:&jsonError];
            if (json) weakSelf.cache[reference] = json;
            completion(json, jsonError);
        }] resume];
}

@end
