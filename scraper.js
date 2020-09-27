/* eslint-disable no-prototype-builtins */
const cheerio = require('cheerio');
const request = require('request');
const youtube = async (query, page) => {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/results?q=${encodeURIComponent(
      query
    )}${page ? `&page=${page}` : ''}`;
    request(url, (error, response, html) => {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(html);
        const json = {results: [], version: require('./package.json').version};
        $('.yt-lockup-dismissable').each((index, vid) => {
          json['parser'] = 'html_format';
          json.results.push(parseOldFormat($, vid));
        });
        if (!json.results.length) {
          json['parser'] = 'json_format';
          let data;
          let sectionLists = [];
          try {
            data = html.substring(html.indexOf('ytInitialData') + 17);
            data = JSON.parse(
              data.substring(
                0,
                data.indexOf('window["ytInitialPlayerResponse"]') - 6
              )
            );
            json['estimatedResults'] = data.estimatedResults || '0';
            sectionLists =
              data.contents.twoColumnSearchResultsRenderer.primaryContents
                .sectionListRenderer.contents;
          } catch (ex) {
            console.error('Failed to parse data:', ex);
            console.log(data);
          }
          sectionLists
            .filter(x => x.hasOwnProperty('itemSectionRenderer'))
            .forEach(sectionList => {
              try {
                sectionList.itemSectionRenderer.contents.forEach(content => {
                  try {
                    if (content.hasOwnProperty('channelRenderer')) {
                      json.results.push(
                        parseChannelRenderer(content.channelRenderer)
                      );
                    }
                    if (content.hasOwnProperty('videoRenderer')) {
                      json.results.push(
                        parseVideoRenderer(content.videoRenderer)
                      );
                    }
                    if (content.hasOwnProperty('radioRenderer')) {
                      json.results.push(
                        parseRadioRenderer(content.radioRenderer)
                      );
                    }
                    if (content.hasOwnProperty('playlistRenderer')) {
                      json.results.push(
                        parsePlaylistRenderer(content.playlistRenderer)
                      );
                    }
                  } catch (ex) {
                    console.error('Failed to parse renderer:', ex);
                    console.log(content);
                  }
                });
              } catch (ex) {
                console.error('Failed to read contents for section list:', ex);
                console.log(sectionList);
              }
            });
        }
        return resolve(json);
      }
      resolve({error: error});
    });
  });
};
const parseOldFormat = ($, vid) => {
  // Get video details
  const $metainfo = $(vid).find('.yt-lockup-meta-info li');
  const $thumbnail = $(vid).find('.yt-thumb img');
  const video = {
    id: $(vid).parent().data('context-item-id'),
    title: $(vid).find('.yt-lockup-title').children().first().text(),
    url: `https://www.youtube.com${$(vid)
      .find('.yt-lockup-title')
      .children()
      .first()
      .attr('href')}`,
    duration: $(vid).find('.video-time').text().trim() || 'Playlist',
    snippet: $(vid).find('.yt-lockup-description').text(),
    upload_date: $metainfo.first().text(),
    thumbnail_src: $thumbnail.data('thumb') || $thumbnail.attr('src'),
    views: $metainfo.last().text(),
  };
  const $byline = $(vid).find('.yt-lockup-byline');
  const uploader = {
    username: $byline.text(),
    url: `https://www.youtube.com${$byline.find('a').attr('href')}`,
    verified: !!$byline.find('[title=Verified]').length,
  };
  return {video: video, uploader: uploader};
};
const parseChannelRenderer = renderer => {
  const channel = {
    id: renderer.channelId,
    title: renderer.title.simpleText,
    url: `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
    snippet: renderer.descriptionSnippet
      ? renderer.descriptionSnippet.runs.reduce(comb, '')
      : '',
    thumbnail_src:
      renderer.thumbnail.thumbnails[renderer.thumbnail.thumbnails.length - 1]
        .url,
    video_count: renderer.videoCountText
      ? renderer.videoCountText.runs.reduce(comb, '')
      : '',
    subscriber_count: renderer.subscriberCountText
      ? renderer.subscriberCountText.simpleText
      : '0 subscribers',
    verified:
      (renderer.ownerBadges &&
        renderer.ownerBadges.some(
          badge => badge.metadataBadgeRenderer.style.indexOf('VERIFIED') > -1
        )) ||
      false,
  };
  return {channel};
};
const parsePlaylistRenderer = renderer => {
  const thumbnails =
    renderer.thumbnailRenderer.playlistVideoThumbnailRenderer.thumbnail
      .thumbnails;
  const playlist = {
    id: renderer.playlistId,
    title: renderer.title.simpleText,
    url: `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
    thumbnail_src: thumbnails[thumbnails.length - 1].url,
    video_count: renderer.videoCount,
  };
  const uploader = {
    username: renderer.shortBylineText.runs[0].text,
    url: `https://www.youtube.com${renderer.shortBylineText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
  };
  return {playlist: playlist, uploader: uploader};
};
const parseRadioRenderer = renderer => {
  const radio = {
    id: renderer.playlistId,
    title: renderer.title.simpleText,
    url: `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
    thumbnail_src:
      renderer.thumbnail.thumbnails[renderer.thumbnail.thumbnails.length - 1]
        .url,
    video_count: renderer.videoCountText.runs.reduce(comb, ''),
  };
  const uploader = {
    username: renderer.shortBylineText
      ? renderer.shortBylineText.simpleText
      : 'YouTube',
  };
  return {radio: radio, uploader: uploader};
};
const parseVideoRenderer = renderer => {
  const video = {
    id: renderer.videoId,
    title: renderer.title.runs.reduce(comb, ''),
    url: `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
    duration: renderer.lengthText ? renderer.lengthText.simpleText : 'Live',
    snippet: renderer.descriptionSnippet
      ? renderer.descriptionSnippet.runs.reduce(
          (a, b) => a + (b.bold ? `<b>${b.text}</b>` : b.text),
          ''
        )
      : '',
    upload_date: renderer.publishedTimeText
      ? renderer.publishedTimeText.simpleText
      : 'Live',
    thumbnail_src:
      renderer.thumbnail.thumbnails[renderer.thumbnail.thumbnails.length - 1]
        .url,
    views: renderer.viewCountText
      ? renderer.viewCountText.simpleText ||
        renderer.viewCountText.runs.reduce(comb, '')
      : renderer.publishedTimeText
      ? '0 views'
      : '0 watching',
  };
  const uploader = {
    username: renderer.ownerText.runs[0].text,
    url: `https://www.youtube.com${renderer.ownerText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
  };
  uploader.verified =
    (renderer.ownerBadges &&
      renderer.ownerBadges.some(
        badge => badge.metadataBadgeRenderer.style.indexOf('VERIFIED') > -1
      )) ||
    false;
  return {video: video, uploader: uploader};
};
const comb = (a, b) => {
  return a + b.text;
};

module.exports.youtube = youtube;
