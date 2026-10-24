plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.novadrop.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.novadrop.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 50200
        versionName = "0.5.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    flavorDimensions += "engine"
    productFlavors {
        create("standard") {
            dimension = "engine"
            isDefault = true
        }
        create("spike") {
            dimension = "engine"
            applicationIdSuffix = ".spike"
            matchingFallbacks += listOf("standard")
            ndk {
                abiFilters += listOf("arm64-v8a", "x86_64")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    sourceSets {
        getByName("spike") {
            manifest.srcFile("src/spike/AndroidManifest.xml")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "21"
    }
    buildFeatures {
        compose = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
        jniLibs {
            useLegacyPackaging = true
        }
    }
}

dependencies {
    // Isolated dependencies for spike flavor:
    val youtubedlAndroidVersion = "0.18.1"
    "spikeImplementation"("io.github.junkfood02.youtubedl-android:library:$youtubedlAndroidVersion")
    "spikeImplementation"("io.github.junkfood02.youtubedl-android:ffmpeg:$youtubedlAndroidVersion")
    "spikeImplementation"("io.github.junkfood02.youtubedl-android:aria2c:$youtubedlAndroidVersion")
    // AndroidX Core & Lifecycle
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Jetpack Compose & Material 3
    val composeBom = platform("androidx.compose:compose-bom:2024.11.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.4")

    // Media3 (ExoPlayer, Session, UI)
    val media3Version = "1.5.0"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    implementation("androidx.media3:media3-session:$media3Version")

    // Room Database
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // DataStore Preferences
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Network & Media Streaming (OkHttp3)
    val okhttpVersion = "4.12.0"
    implementation("com.squareup.okhttp3:okhttp:$okhttpVersion")
    implementation("com.squareup.okhttp3:logging-interceptor:$okhttpVersion")

    // Image loading (Coil Compose)
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Core Library Desugaring for Java 8+ APIs
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.3")

    // NewPipeExtractor for native YouTube / streaming media extraction
    implementation("com.github.TeamNewPipe:NewPipeExtractor:v0.26.5")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("org.json:json:20240303")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
