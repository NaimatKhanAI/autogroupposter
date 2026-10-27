const { withAppBuildGradle, withSettingsGradle } = require('expo/config-plugins');

// Worklets applies Spotless while configuring consumers. Resolve its published
// implementation from Maven Central without relying on the plugin-portal marker.
module.exports = (config) => {
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('// GroupPoster bundle inputs')) {
      config.modResults.contents += `
// GroupPoster bundle inputs: exclude preserved dependencies and track local env changes.
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    sources.exclude("node_modules.previous/**", ".expo/**", "dist/**")
    inputs.files(fileTree(projectRoot) {
        include ".env", ".env.*"
        exclude ".env.example"
    })
}
`;
    }
    return config;
  });
  return withSettingsGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      'ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)',
      'ex.autolinkLibrariesFromCommand(["node", new File(rootDir, "../scripts/android-autolink.cjs").absolutePath, rootDir.parentFile.absolutePath])',
    );
    if (!config.modResults.contents.includes('// GroupPoster Windows build paths')) {
      config.modResults.contents += `
// GroupPoster Windows build paths: Expo resolves SUBST paths to the physical drive.
if (System.getProperty("os.name").toLowerCase().contains("windows")) {
  def physicalRoot = providers.exec {
    workingDir(rootDir.parentFile)
    commandLine("node", "--print", "require('fs').realpathSync.native('.')")
  }.standardOutput.asText.get().trim().replace('\\\\', '/')
  def buildRoot = rootDir.parentFile.absolutePath.replace('\\\\', '/')
  def remapProject
  remapProject = { descriptor ->
    def source = descriptor.projectDir.absolutePath.replace('\\\\', '/')
    if (source.toLowerCase().startsWith(physicalRoot.toLowerCase() + '/')) {
      descriptor.projectDir = new File(buildRoot + source.substring(physicalRoot.length()))
    }
    descriptor.children.each { remapProject(it) }
  }
  remapProject(rootProject)
}
`;
    }
    if (config.modResults.contents.includes('spotless-plugin-gradle:')) return config;
    const repositories = `
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
  resolutionStrategy {
    eachPlugin {
      if (requested.id.id == "com.diffplug.spotless") {
        useModule("com.diffplug.spotless:spotless-plugin-gradle:" + requested.version)
      }
    }
  }
`;
    config.modResults.contents = config.modResults.contents.replace(
      'pluginManagement {',
      'pluginManagement {' + repositories,
    );
    return config;
  });
};
