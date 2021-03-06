# sfdy

sfdy is a command line tool to work with the [Salesforce Metadata API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_intro.htm). 
It has been built to work around strange behaviours and known limitations of the api, and to simplify the implementation of a continuous integration process. It applies [useful patches](#apply-standard-patches-to-metadata-after-retrieve) to avoid common problems when deploying metadata, and it exposes a simple interface to [build your own plugins](#build-your-own-plugins)

1. [Requirements](#requirements)
1. [Usage](#usage)
1. [Why not SFDX?](#why-not-sfdx)
1. [Installation](#installation)
1. [Features](#features)
1. [Changelog](#changelog)

## Requirements

- [Node.js](https://nodejs.org/en/) at least `10.x.x`

## Usage

`sfdy` is meant to be mainly used as a command line tool. It can also be used a library since it exposes a small [API](#use-sfdy-as-a-library).

Type `sfdy --help` to see available commands. Type `sfdy [command] --help` to see available options for a specific command

## Why not SFDX?

[SFDX](https://developer.salesforce.com/tools/sfdxcli) is a tool to work with scratch orgs and with modular projects. 

In a typical salesforce project, the development starts in a scratch org or in a classic sandbox. 
Even if you use scratch orgs, however, soon or later you'll have to deploy your sfdx project to a classic sandbox (a shared, persistant development sandbox used to test integrations, an UAT sandbox, etc.). After the code is in a classic sandbox, we are right back where we started.

Moreover, DX requires the developer to break down their entire Enterprise org into individual projects, but sometimes this is not possible/advisable. Salesforce metadata are deeply interconnected, and every module is very likely to use a subset of common functionalities (standard objects, layout, flexipages). It is often a nightmare to divide an enterprise project in modules, because those modules are not really independent from each other. 

Finally, this tool solve some problems that SFDX does not address, and give the developer an easy way to customize a Salesforce CI process the way HE wants. To have the best possible experience, use this tool in conjunction with the vscode plugin [fast-sfdc](https://marketplace.visualstudio.com/items?itemName=m1ck83.fast-sfdc). patches and even your custom plugins are automatically applied in both your CI flow and your local development environment!

## Installation

```
$ npm install -g sfdy
```

then go to the root folder of a Salesforce project, and type

```
$ sfdy init
```

this command creates a `.sfdy.json` file with the configuration of the 'standard' patches (more on this [later](#apply-standard-patches-to-metadata-after-retrieve))

## Features
1. [Retrieve full metadata (based on package.xml)](#retrieve-full-metadata)
1. [Retrieve partial metadata (glob pattern or metadata-based)](#retrieve-partial-metadata)
1. [Deploy full metadata (based on package.xml)](#deploy-full-metadata)
1. [Deploy partial metadata (glob pattern or diff between 2 git branches)](#deploy-partial-metadata)
1. [Apply 'standard' patches to metadata after retrieve](#apply-standard-patches-to-metadata-after-retrieve)
1. [Build your own plugins (pre-deploy and after-retrieve)](#build-your-own-plugins)
1. [Build your own renderers](#build-your-own-renderers)
1. [Use `sfdy` as a library](#use-sfdy-as-a-library)

### Retrieve full metadata

From the root folder of your salesforce project, type:

```
$ sfdy retrieve -u USERNAME -p PASSWORD -s
```

This command will retrieve all metadata specified in package.xml and will apply any enabled patch.

The `-s` flag should be used when connecting to a sandbox.

### Retrieve partial metadata

#### using --files

```
$ sfdy retrieve -u USERNAME -p PASSWORD -s --files='objects/*,!objects/Account*,site*/**/*'
```

This command will retrieve all objects present in the local `objects` folder, except those whose name starts with `Account`, and will retrieve all metadata (present in the local project) whose folder starts with `site` (for example `sites`, `siteDotCom`)

The --files consists in a comma-separated list of [glob pattern](https://www.npmjs.com/package/globby)
#### using --meta

```
$ sfdy retrieve -u USERNAME -p PASSWORD -s --meta='CustomObject/Account,FlexiPage/*'
```

This command will retrieve the Account object and all the flexipages present on the target salesforce environment

> **Warning:** the --meta option builds an ad-hoc package.xml to retrieve the data. Glob patterns cannot be used in this case. You can use a wildcard only if that metadata supports it

### Deploy full metadata

```
$ sfdy deploy -u USERNAME -p PASSWORD -s
```

This command will apply any enabled pre-deploy patch and will deploy all metadata specified in package.xml.

The `-s` flag should be used when connecting to a sandbox.

### Deploy partial metadata

#### using --files

```
$ sfdy deploy -u USERNAME -p PASSWORD -s --files='objects/*,!objects/Account*,site*/**/*'
```

This command will deploy all objects present in the local `objects` folder, except those whose name starts with `Account`, and will deploy all metadata (present in the local project) whose folder starts with `site` (for example `sites`, `siteDotCom`)

The --files consists in a comma-separated list of [glob pattern](https://www.npmjs.com/package/globby)

#### using --diff

```
$ sfdy deploy -u USERNAME -p PASSWORD -s --diff='aheadBranch..behindBranch'
```

The `--diff` flag is used to compute the list of files that needs to be deployed comparing 2 git branches. (examples: `--diff='HEAD..origin/myBranch'` or `--diff='branch1..branch2`). As an example of use case, you can trigger a deploy to the DEV environment when you create a pull-request to the dev branch. The deploy will contain only the files that have been modified in the pull-request

> **Warning:** the --diff option requires git. The salesforce project must obviously be versioned

### Apply 'standard' patches to metadata after retrieve

Sfdy provides a number of ready to use patches that you may find useful.
All these patches serve 2 purposes:

1. **Remove useless metadata** (not translated fields, useless FLS in permission sets, roles that are automatically managed by salesforce, profile permissions in standard profiles, stuff created by managed packages at installation time)
2. **Add useful metadata**. We want our repo to really be the 'source of truth' (ALL profile permissions, not only the enabled ones. ALL object permissions. Profile configuration of objects/applications/tabs that we DON'T want to version because they're not used or we're not the mantainer of those metadata)

All of these patches can be disabled, so you can incrementally adopt them or skip a specific patch if you don't find it useful.

First of all, create the configuration file `.sfdy.json` in the root folder of the salesforce project:

```
$ sfdy init
```

The configuration file is a JSON object:
```json
{
  "permissionSets": {
    "stripUselessFls": true
  },
  "objectTranslations": {
    "stripUntranslatedFields": true,
    "stripNotVersionedFields": true
  },
  "preDeployPlugins": [],
  "postRetrievePlugins": [],
  "renderers": [],
  "profiles": {
    "addAllUserPermissions": false,
    "addDisabledVersionedObjects": true,
    "addExtraObjects": ["*", "!*__?", "!CommSubscription*"],
    "addExtraTabVisibility": ["standard-*"],
    "addExtraApplications": ["standard__*"],
    "stripUserPermissionsFromStandardProfiles": true,
    "stripUnversionedStuff": true
  },
  "roles": {
    "stripPartnerRoles": true
  },
  "stripManagedPackageFields": ["et4ae5"]
}
```

#### permissionSets

| Patch | Description |
| --- | --- |
| stripUselessFls | if `stripUselessFls` is `true`, `fieldPermissions` in which both `readable` and `editable` tags are `false` are removed from the XML. They are totally redundand since a `PermissionSet` can only add permissions. |

#### objectTranslations

| Patch | Metadata | Description |
| --- | --- | --- |
| stripUntranslatedFields | Translations, CustomObjectTranslation, GlobalValueSetTranslation, StandardValueSetTranslation  | if `stripUntranslatedFields` is `true`, untranslated tags are removed from the XML. |
| stripNotVersionedFields | CustomObjectTranslation | if `stripNotVersionedFields` is `true`, translated fields that are not present in the filesystem in the corresponding `.object` files, are removed from the XML. |

#### profiles

| Patch | Description |
| --- | --- |
| addAllUserPermissions | Salesforce does not retrieve disabled `userPermissions`. If `addAllUserPermissions` is `true`, all permissions are retrieved |
| addDisabledVersionedObjects | Salesforce does not retrieve totally disabled objects. If `addDisabledVersionedObjects` is `true`, sfdy retrieves also `objectsPermissions` of objects that are versioned (present in the filesystem) but are disabled for the profile |
| addExtraObjects | Sometimes you want to explicitly configure the access level to some objects even if you're not interested in versioning the whole object. Now you can. `addExtraObjects` is an array of glob patterns of the objects whose `objectPermissions` you want to add to the profile (the glob patterns match against the `<member>` content in `package.xml`) |
| addExtraTabVisibility | Sometimes you want to explicitly set the `TabVisibility` of some tabs even if you're not interested in versioning the object/tab. Now you can. `addExtraTabVisibility` is an array of glob patterns of the tabs whose `tabVisibilities` you want to add to the profile (the glob patterns match against the `<member>` content in `package.xml`) |
| stripUserPermissionsFromStandardProfiles | User Permissions are not editable in standard profiles, and they change almost every Salesforce release causing errors that can be avoided. Set this flag to `true` to automatically remove them |
| stripUnversionedStuff | This flag 'sanitize' the profiles, removing `fieldPermissions`, `classAccesses`, `pageAccesses`, `layoutAssignments` that are not related to versioned stuff. I can't really see any reason not to enable this option, that can help to avoid errors made by developers during versioning |

#### roles

| Patch | Description |
| --- | --- |
| stripPartnerRoles | if `stripPartnerRoles` is `true`, roles that ends with `PartnerUser[0-9]*.role` are removed even if a `*` is used in `package.xml`. They are automatically created by Salesforce when you create a partner account, so there's no need to version them |

#### other

| Patch | Metadata | Description |
| --- | --- | --- |
| stripManagedPackageFields | CustomObject, PermissionSet, Profile | Array of namespaces of stuff created by managed packages (eg Marketing Cloud) that we don't want to version. This plugin removes `fields`, `picklistValues`, `weblinks` from `CustomObject` and `fieldPermissions` from `Profile` and `PermisissionSet` |

### Build your own plugins

`sfdy` offer a convenient way to develop your own plugin. This is really useful in many occasions. Typical use cases are change endpoints of named credentials or email addresses in workflow's email alerts on the basis of the target org, but the possibilities are endless. You can even query salesforce (rest api or tooling api) to conditionally apply transformations of the metadata on the basis of information coming from the target org.


All the standard plugins are built usign the plugin engine of `sfdy`, so the best reference to understand how to develop a custom plugin is to look at the [plugins](src/plugins) folder in which all the standard plugins reside.


A plugin is a `.js` file that exports a function with this signature:

```javascript
module.exports = async (context, helpers, utils) => {
  //TODO -> Plugin implementation
}
```

#### `context`

* `sfdcConnector` - an instance of a Salesforce connector. It exposes 2 methods, `query` and `rest`
* `environment` - The value of the environment variable `environment`. It can be used to execute different patches in different sandboxes
* `username` - The username used to login
* `log` - A `log` function that should be used instead of `console.log` if you want to log something. The reason is that, when used as a library, `sfdy` can accept a custom logger implementation. When used as a command line tool, the `log` function fallbacks to `console.log`
* `pkg` - A json representation of the `package.xml`
* `config` - The content of `.sfdy.json` (as a JSON object)

#### `helpers`

* `xmlTransformer (pattern, callback1)` - This helper allows the developer to easily transform one or more metadata (identified by `pattern`), using a `callback` function. See [examples](#examples) to understand how to use it
* `modifyRawContent (pattern, callback2)` - This helper allows the developer to manipulate the whole metadata file. It is useful if you want to edit a file that is not an xml, or if you want to apply drastical transformations
* `filterMetadata (filterFn)` - This helper can be used in a post-retrieve plugin to filter out unwanted metadata
* `requireMetadata (pattern, callback3)` - This helper can be used to define dependencies between metadata. For example, a `Profile` must be retrieved together with `CustomObject` in order to retrieve the list of `fieldPermissions`. If you define such a dependency using `requireMetadata`, when you retrieve a `Profile`, all dependent metadata are automatically included in the `package.xml` and eventually discarded at the end of the retrieve operation

`callback1 (filename, fJson)`:

* `filename` - The current filename
* `fJson`  -  JSON representation of the XML. You can modify the object to modify the XML

`callback2 (filename, file)`:

* `filename` - The current filename
* `file` is an object containing a `data` field. `data` is a buffer containing the whole file. You can modify `data` to modify the file

`filterFn (filename)`:

* `filename` - The current filename, including the path (for example `classes/MyClass.cls`)

`callback3 ({ filterPackage, requirePackage })`:

* `filterPackage (arrayOfMetadata)` - A function taking an array of metadata that should be included together with metadata matched by `pattern`. The 'companions' will be retrieved only if they are present in the stored `package.xml`. For example, if you retrieve a profile, the profile will be retrieved together with the versioned `CustomObject`

* `requirePackage (arrayOfMetadata)` - The same as `filterPackage`, but the included metadata will be added to `package.xml` regardless if they were present before or not. In this case `arrayOfMetadata` is an array of 'pseudo' glob patterns (ex. `['CustomApplication/*', 'CustomObject/Account']`)

### utils `{ parseXml, buildXml, parseXmlNoArray }`

Helpers function. See [here](src/utils/xml-utils.js)


To instruct `sfdy` to use your plugin, you have to configure the path of your plugin in the `.sfdy.json` file:

```json
{
  "preDeployPlugins": ["sfdy-plugins/my-awesome-plugin.js"],
  "postRetrievePlugins": ["sfdy-plugins/my-wonderful-plugin.js"]
}
```

You have 2 different 'hooks' to choose from:
* `postRetrievePlugins` are executed just before the metadata retrieved from Salesforce is stored on the filesystem
* `preDeployPlugins` are executed before deploying metadata to Salesforce



#### Examples

##### Change the endpoint of a named credential (better suited as a `preDeployPlugin`)

```javascript
module.exports = async ({ environment, log }, helpers) => {
  helpers.xmlTransformer('namedCredentials/*', async (filename, fJson) => {
    log(`Patching ${filename}...`)    
    if(filename === 'idontwanttochangethis.NamedCredential') return

    switch(environment) {
      case 'uat':
        fJson.endpoint = 'https://uat-endpoint.com/restservice'
        break
      case 'prod':
        fJson.endpoint = 'https://prod-endpoint.com/restservice'
        break
      default:
        fJson.endpoint = 'https://test-endpoint.com/restservice'
        break
      
      log('Done')    
    }
  })
}
```

##### Remove every field and every apex class that starts with `Test_` (better suited as a `postRetrievePlugin`)

```javascript
module.exports = async ({ environment, log }, helpers) => {
  helpers.xmlTransformer('objects/*', async (filename, fJson) => {
    log(`Patching ${filename}...`)    
    fJson.fields = (fJson.fields || []).filter(field => !field.FullName[0].startsWith('Test_'))
    log('Done')        
  })

  helpers.filterMetadata(fileName => !/classes\/Test_[^\/]+\.cls$/.test(fileName))
}
```

> **Warning:** fJson contains the json representation of the metadata file. The root tag of the metadata is omitted for convenience. Every tag is treated as an array 

> **Warning:** The callback function ot the `xmlTransformer` helper MUST return a `Promise`

##### Query Salesforce to apply advanced transformations

See [this](src/plugins/profile-plugins/add-all-permissions-to-custom-profiles.js)

#### Define dependencies between metadata

See [this](src/plugins/dependency-graph.js)

### Build your own renderers

A renderer is a `.js` file that exports an object with this signature:

```javascript
module.exports = {
  transform: async (context, helpers, utils) => {
    //TODO -> Transform
  },
  untransform: async (context, helpers, utils) => {
    //TODO -> Untransform
  }
}
```

The `transform` function is applied after retrieve and after the execution of the post retrieve plugins. The `untransform` function is applied as soon as you start a deploy, before the application of the pre deploy plugins and the actual deploy.

A renderer can be used to totally transform the metadata in the format you like. For example you could think to split a `.object` file in different files, one for `fields` and one per `recordtypes`, or to even convert everything in json, or to represent some information as a `.csv` file. You can do what best fit your needs.

To instruct `sfdy` to use your renderer, you have to configure the path of your renderer in the `.sfdy.json` file:

```json
{
  "renderers": ["sfdy-plugins/my-awesome-renderer.js"]
}
```

#### Example - Store profiles as json files

```js
module.exports = {
  transform: async (context, helpers, { parseXmlNoArray }) => {
    helpers.modifyRawContent('profiles/*', async (filename, file) => {
      const fJson = await parseXmlNoArray(file.data)
      file.data = Buffer.from(JSON.stringify(fJson, null, 2), 'utf8')
    })
  },
  untransform: async (context, helpers, { buildXml }) => {
    helpers.modifyRawContent('profiles/*', async (filename, file) => {
      const fJson = JSON.parse(file.data.toString())
      file.data = Buffer.from(buildXml(fJson), 'utf8')
    })
  }
}
```

### Use `sfdy` as a library

Is simple as that:

```
$ npm i sfdy
```

#### retrieve
```js
const retrieve = require('sfdy/src/retrieve')

retrieve({
  basePath: 'root/folder',
  config: {
    //.sfdy.json like config
  },
  files: [ /*specific files*/ ],
  loginOpts: {
    serverUrl: creds.url,
    username: creds.username,
    password: creds.password
  },
  meta: [/*specific meta*/]
  logger: (msg: string) => logger.appendLine(msg)
}).then(() => console.log('Done!'))
```

#### deploy

```js
const deploy = require('sfdy/src/deploy')

deploy({
  logger: (msg: string) => logger.appendLine(msg),
  preDeployPlugins,
  renderers,
  basePath: 'root/folder',
  loginOpts: {
    serverUrl: creds.url,
    username: creds.username,
    password: creds.password
  },
  checkOnly,
  files: ['specific', 'files']
}).then(() => console.log('Done!'))
```


## Changelog

* 1.1.0 - First release