'use strict'

const _ = require('lodash')
const React = require('react')
const ReactNative = require('react-native')

const PropTypes = require('prop-types')

const ImageCacheManagerOptionsPropTypes = require('./ImageCacheManagerOptionsPropTypes')

const ImageCacheManager = require('./ImageCacheManager')

const {
  View,
  Image,
  NetInfo,
  StyleSheet
} = ReactNative

const CACHED_IMAGE_REF = 'cachedImage'

const propTypes = {
  canMakeRequest: PropTypes.bool,
  renderImage: PropTypes.func,
  renderFallback: PropTypes.func.isRequired,

  // ImageCacheManager options
  ...ImageCacheManagerOptionsPropTypes
}

const defaultProps = {
  canMakeRequest: true
}

class CachedImage extends React.Component {
  static contextTypes = {
    getImageCacheManager: PropTypes.func
  }

  constructor (props) {
    super(props)

    this._isMounted = false

    this.state = {
      isCacheable: true,
      cachedImagePath: null,
      cachedImageSource: null,
      hasConnection: false
    }

    this.getImageCacheManagerOptions = this.getImageCacheManagerOptions.bind(this)
    this.getImageCacheManager = this.getImageCacheManager.bind(this)
    this.safeSetState = this.safeSetState.bind(this)
    this.handleConnectivityChange = this.handleConnectivityChange.bind(this)
    this.processSource = this.processSource.bind(this)
  }

  componentWillMount () {
    this._isMounted = true
    NetInfo.isConnected.addEventListener('connectionChange', this.handleConnectivityChange)

    // initial
    NetInfo.isConnected.fetch()
           .then(hasConnection => {
             this.safeSetState({hasConnection},
               () => {
                 this.processSource(this.props.source)
               })
           })
  }

  componentWillUnmount () {
    this._isMounted = false
    NetInfo.isConnected.removeEventListener('connectionChange', this.handleConnectivityChange)
  }

  componentWillReceiveProps (nextProps) {
    this.processSource(nextProps.source, nextProps.canMakeRequest)
  }

  // noinspection JSUnusedGlobalSymbols
  setNativeProps (nativeProps) {
    try {
      this.refs[CACHED_IMAGE_REF].setNativeProps(nativeProps)
    } catch (e) {
      console.error(e)
    }
  }

  getImageCacheManagerOptions () {
    return _.pick(this.props, _.keys(ImageCacheManagerOptionsPropTypes))
  }

  getImageCacheManager () {
    // try to get ImageCacheManager from context
    if (this.context && this.context.getImageCacheManager) {
      return this.context.getImageCacheManager()
    }

    // create a new one if context is not available
    const options = this.getImageCacheManagerOptions()
    return ImageCacheManager(options)
  }

  safeSetState (newState, callback) {
    if (!this._isMounted) {
      return
    }

    return this.setState(newState, callback)
  }

  handleConnectivityChange (hasConnection) {
    this.safeSetState({hasConnection},
      () => {
        this.processSource(this.props.source, this.props.canMakeRequest)
      })
  }

  processSource (source, canMakeRequest) {
    const isImageInCache = this.state.isCacheable && this.state.cachedImagePath
    const sameSource = _.isEqual(source, this.state.cachedImageSource)

    if (sameSource && (isImageInCache || !canMakeRequest || !this.state.hasConnection)) {
      return
    }

    const url = _.get(source, ['uri'], null)
    const options = this.getImageCacheManagerOptions()
    if (source.headers) {
      options.headers = source.headers
    }

    const imageCacheManager = this.getImageCacheManager()

    imageCacheManager.downloadAndCacheUrl(url, options)
                     .then(cachedImagePath => {
                       debugger
                       this.safeSetState({
                         cachedImagePath,
                         cachedImageSource: source
                       })
                     })
                     .catch((...err) => {
                       console.log(err)
                       debugger
                       this.safeSetState({
                         cachedImagePath: null,
                         cachedImageSource: null,
                         isCacheable: false
                       })
                     })
  }

  renderImage (imageProps) {
    const {renderImage} = this.props

    if (renderImage) {
      return renderImage(imageProps)
    } else {
      return <Image ref={CACHED_IMAGE_REF} {...imageProps}/>
    }
  }

  renderFallback () {
    return (
      <View style={styles.fallback}>
        {this.props.renderFallback()}
      </View>
    )
  }

  render () {
    if (!this.state.cachedImagePath) {
      debugger
      return this.renderFallback()
    }

    const imageProps = getImageProps(this.props)
    const style = this.props.style || styles.image

    const source = this.state.isCacheable && this.state.cachedImagePath
      ? {uri: 'file://' + this.state.cachedImagePath}
      : this.props.source

    debugger
    return this.renderImage({
      ...imageProps,
      key: imageProps.key || source.uri,
      style,
      source
    })
  }
}

CachedImage.propTypes = propTypes
CachedImage.defaultProps = defaultProps

function getImageProps (props) {
  return _.omit(props, [
    'source', 'defaultSource', 'fallbackSource',
    'renderImage',
    'loadingIndicator', 'activityIndicatorProps',
    'style',
    'useQueryParamsInCacheKey', 'resolveHeaders'
  ])
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'transparent'
  },
  fallback: {
    backgroundColor: 'transparent'
  },
  loaderPlaceholder: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  }
})

module.exports = CachedImage