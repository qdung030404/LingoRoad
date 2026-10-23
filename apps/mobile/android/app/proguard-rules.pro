# Pigeon JNI looks up these Kotlin coroutine classes by their original names.
# Required by shared_preferences_android 2.5.x / package:jni in minified builds.
# https://flutter.googlesource.com/mirrors/packages/+/refs/heads/main/packages/pigeon/native_interop_guide.md
-keep class kotlin.Unit { *; }
-keep class kotlin.Result { *; }
-keep class kotlin.Result$Failure { *; }
-keep class kotlin.coroutines.Continuation { *; }
-keep class kotlin.coroutines.intrinsics.CoroutineSingletons { *; }
-keep class kotlin.coroutines.intrinsics.IntrinsicsKt { *; }
