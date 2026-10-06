use lru::LruCache;
use std::num::NonZeroUsize;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};

#[test]
fn iter_mut_keeps_keys_shared_while_values_remain_mutable() {
    let mut cache: LruCache<i32, i32> = LruCache::new(NonZeroUsize::new(3).unwrap());
    cache.put(1, 10);
    cache.put(2, 20);
    cache.put(3, 30);

    for (_key, value) in cache.iter_mut() {
        *value *= 2;
    }

    assert_eq!(cache.get(&1), Some(&20));
    assert_eq!(cache.get(&2), Some(&40));
    assert_eq!(cache.get(&3), Some(&60));
}

#[test]
fn pop_with_panicking_key_drop_leaves_lru_list_consistent() {
    static ARMED: AtomicBool = AtomicBool::new(false);

    #[derive(PartialEq, Eq, Hash)]
    struct PanicKey(u32);

    impl Drop for PanicKey {
        fn drop(&mut self) {
            if ARMED.swap(false, Ordering::SeqCst) {
                panic!("PanicKey::drop");
            }
        }
    }

    let mut cache = LruCache::new(NonZeroUsize::new(4).unwrap());
    cache.put(PanicKey(1), "a");
    cache.put(PanicKey(2), "b");
    cache.put(PanicKey(3), "c");

    ARMED.store(true, Ordering::SeqCst);
    let result = catch_unwind(AssertUnwindSafe(|| {
        cache.pop(&PanicKey(2));
    }));
    assert!(result.is_err());

    cache.put(PanicKey(4), "d");
    cache.put(PanicKey(5), "e");
    let _ = cache.get(&PanicKey(3));
    assert_eq!(cache.iter().count(), 4);
}
