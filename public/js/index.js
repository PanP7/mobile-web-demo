window.addEventListener('load', function() {
  new FastClick(document.body);
}, false);


//calling these functions lets us correctly animate transition direction in changePage
var direction  = '';
var goForward = function (hash) {
  direction = 'forward';
  window.location.hash = hash;
}
var goHistory = function (step) {
  direction = step < 0 ? 'backward' : 'forward';
  window.history.go(step);
}


jQuery(function($){

var hb = {};
var handlebarIt = function(selector, args) {
  if (!hb[selector]) {
    hb[selector] = Handlebars.compile($(selector).html());
  }
  return hb[selector](args);
}

var iscrolls = {};
var iscrollIt = function(selector) {
  if (iscrolls[selector] != null) iscrolls[selector].destroy();
  iscrolls[selector] = new iScroll(
    $(selector).get(0), 
    { scrollbarClass: 'scrolly', 
      useTransition:true, 
      bounce:false,
      zoom: false,
      onBeforeScrollStart: function (e) { 
        var target = e.target;
        while (target.nodeType != 1) target = target.parentNode;
        if (target.tagName != 'SELECT' && target.tagName != 'INPUT' && target.tagName != 'TEXTAREA')
        e.preventDefault();
      }
    }
  );
}

var fetchCache = {};
var fetchJSON = function(url, callback, secondsToCache) {
  secondsToCache = secondsToCache ? secondsToCache : 60*60; //default to one hour
  var nowInSeconds = Math.round(new Date().getTime() / 1000);
  if (!fetchCache[url] || ((fetchCache[url].timestamp + secondsToCache) < nowInSeconds)) {
    $.getJSON(url, function(response) {
      fetchCache[url] = {response: response, timestamp: nowInSeconds};
      callback(fetchCache[url].response);
    });
  }
  else {
    callback(fetchCache[url].response);
  }
}

var getJSON = function(itemName) {
  item = JSON.parse(window.localStorage.getItem(itemName))
  return !item ? {} : item; 
}

var setJSON = function (itemName, item) {
  window.localStorage.setItem(itemName, JSON.stringify(item));
}

function loadPage(pageTitle, pageClass, args) {
  var page = $(handlebarIt("#page-tpl", {pageClassName: pageClass, pageTitle: pageTitle}));
  changePage(page);
  window.setTimeout.apply(this, args)
}

function changePageNoAnimation(page) {  
  if ($('.stage-center').hasClass('disabled')) {
    $(page).addClass('disabled');
  }
  $('.page').remove();
  $(page).addClass('page stage-center transition');
  $('body').append(page);

  setTimeout(function() {
    $(page).removeClass('disabled');
    registerPageEvents();
  });
}

function changePage(newPage) {
  var self = this;
  var currentPage = $('.stage-center');
  $('.stage-right, .stage-left').remove(); // Cleaning up: remove old pages that were moved out of the viewport
   
  var newClasses = 'page stage-center transition';
  currentClasses = 'page stage-left transition';
  
  if (currentPage.length == 0 || direction == '') { // If this is the first page, add it without animation
    $(newPage).attr('class', 'page stage-center');
    currentClasses = 'page stage-left';
  }
  else if ($(currentPage).hasClass('disabled')) { //if menu is open, only animate the menu close
    $(newPage).attr('class', 'page stage-center disabled transition');
    currentClasses = 'page stage-left';
  }
  else if (direction == 'forward') {
    $(newPage).attr('class', 'page stage-right');
  }
  else {
    $(newPage).attr('class', 'page stage-left');
    currentClasses = 'page stage-right transition';
  }

  direction = '';
  $('body').append(newPage);
  setTimeout(function() { // Wait until the new page has been added to the DOM...
      $(currentPage).attr('class', currentClasses);
      $(newPage).attr('class', newClasses);
      registerPageEvents();
  });
};

//define Router
AppRouter = Backbone.Router.extend({
    routes: {
      "":"searchPage",
      "item/:name":"listPage",
      "item/:name/:id":"itemPage",
      'search/:scope/:query':"resultsPage",
      'beer/:id':"beerPage",
      'brewery/:id':"breweryPage",
      'bdb/*splat':"bdbLog",
      'nearby':'nearbyPage'
    },

    searchPage: function() {
      loadPage('Search', 'home-page', [renderSearchForm, 300]);
    },
    listPage: function (name) {
      loadPage(name, 'list-page', [renderListContent, 1200, name]);
    },
    itemPage: function (name, id) {
      loadPage(name + ' ' + id, 'item-page', [renderItemContent, 4000, name, id]);
    },
    resultsPage: function(scope, query) {
      loadPage('Search: ' + query, 'results-page', [renderResults, 0, scope, query]);
    },
    beerPage: function(id) {
      loadPage('', 'beer-page', [renderResult, 0, 'beer', id])
    },
    breweryPage: function(id) {
      loadPage('', 'brewery-page', [renderResult, 0, 'brewery', id])
    },
    bdbLog: function(splat) {
      fetchJSON('/bdb/' + splat, function(response) { console.log(response); });
    },
    nearbyPage: function() {
      loadPage('Nearby Breweries', 'nearby-page', [renderNearby, 0])
    }
});
var appRouter = new AppRouter();
Backbone.history.start();

function renderSearchForm(scope, query) {
  scope = scope ? scope : 'all';
  query = query ? query : '';
  $('.stage-center .content-inner').html(handlebarIt("#search-form-tpl", {query: query}));
  $('.search-scope li a').click(function(e) {
    $('.search-scope li.active').removeClass('active');
    $(this).parent().addClass('active');
    var sourceElement = this;
    $('#search-input').each(function() {
      $(this).attr('placeholder', $(sourceElement).attr('data-placeholder'));
      if ($(this).val() != '') {
        scope = $(sourceElement).attr('data-scope');
        query = $(this).val();
        //loadPage('Search: ' + query, 'results-page', [renderResults, 0, scope, query])
      }
    });
  }); 
  $('.search-scope li a[data-scope="' + scope + '"]').click();
  $('.form-search').submit(function(e) {
    var scope = $('.search-scope li.active a').attr('data-scope');
    location.hash = 'search/' + (scope ? scope : 'all') + '/' + $('#search-input').val();
    return false;
  });
  $('#search-input').val(query);
  iscrollIt('.stage-center .content');
}

function renderResults(scope, query) {
  renderSearchForm(scope, query);
  var el = $('.stage-center .content-inner');
  $(el).append('<ul class="result-ul"><p id="loading"><span>.</span><span>.</span><span>.</span></p></ul>');
  var url = "/bdb/search?withBreweries=Y&q=" + query;
  if (scope == 'beers') url += '&type=beer';
  else if (scope == 'breweries') url += '&type=brewery';
  fetchJSON(url, function(response) {
    console.log(response);
    var output = '';
    $('.pull-right').prepend('<li class="brand">' + response.totalResults + '</li>');
    $(response.data).each(function() {
      var tpl = this.type == 'brewery' ? '#brewery-li-tpl' : '#beer-li-tpl';
      output += handlebarIt(tpl, {obj: this});
    });
    $('.result-ul', el).html(output);
    iscrollIt('.stage-center .content');
  });
}

function renderResult(type, id) {
  fetchJSON("/bdb/" + type + "/" + id + "?withBreweries=Y", function(response) {
    console.log(response);
    var el = $('.stage-center .content-inner');
    $(el).html(handlebarIt("#"+ type + "-tpl", {obj: response.data}));
    $('.brand').html(response.data.name);
    renderBookmarkLink(type, id, response.data.name);            
    if (type == 'brewery') {
      $(el).append('<ul class="result-ul"><p id="loading"><span>.</span><span>.</span><span>.</span></p></ul>');
      var output = '';
      fetchJSON("/bdb/" + type + "/" + id + "/beers?withBreweries=Y", function(response) {
        $(response.data).each(function() {
          output += handlebarIt('#beer-li-tpl', {obj: this});
        });
        $('.result-ul', el).html(output);
        iscrollIt('.stage-center .content');
      });
    }
    else if (type == 'beer') {
      var output = '';
      $(response.data.breweries).each(function() {
        output += handlebarIt('#brewery-li-tpl', {obj: this});
      });
      $('.breweries', el).html('<ul class="result-ul">' + output + '</ul>');
    }
    iscrollIt('.stage-center .content');
  });
}

function renderBookmarkLink(type, id, name) {
  bookmarks = getJSON('bookmarks');
  var path = type + '/' + id;
  $('#marklink i').attr('class', bookmarks[path] ? 'icon-star' : 'icon-star-empty');
  $('#marklink').click(function() {
    if (!bookmarks[path]) {
      bookmarks[path] = {id: id, name: name, type: type, path: path}; 
      setJSON('bookmarks', bookmarks);
      renderBookmarks();
      renderAlert('Bookmark added.', $('#marklink'));
      $('#marklink i').attr('class', 'icon-star');
    }
    else {
      delete bookmarks[path];
      setJSON('bookmarks', bookmarks);
      renderBookmarks();
      renderAlert('Bookmark removed.', $('#marklink'));              
      $('#marklink i').attr('class', 'icon-star-empty');
    }
  });
}

function renderAlert(text, el) {
  $(el).tooltip({
     placement: 'bottom',
     title: text,
     trigger: 'manual',
     delay: 500
  });
  $(el).tooltip('show');
  window.setTimeout(function() { $(el).tooltip('destroy'); }, 1000);          
}


function renderBookmarks() {
  $('#bookmarks').html(handlebarIt('#bookmark-li-tpl', {bookmarks: getJSON('bookmarks')}));
}

function registerPageEvents() {          
  $('.stage-center').bind('touchstart mousedown', function(){
    $(this).removeClass('disabled');
  });

  $('.menulink').bind('touchstart mousedown', function(e) {
    //use this for phones with no dedicated back button
    if (Backbone.history.fragment == '' || Backbone.history.fragment.indexOf('search') == 0) {
      $('.stage-center').toggleClass('disabled');
    }
    else {
      goHistory(-1);      
    }
    return false;
  });

  var touchstart;
  $('.stage-center').bind('touchstart', function(e){
    touchstart = e.originalEvent.touches[0];
  }).bind('touchmove', function(e) {//alert(touchstart + '|' + e.touches[0].pageX);
    var touchmove = e.originalEvent.touches[0];
    if (touchmove.pageX > touchstart.pageX + 50 && (touchmove.pageY - touchstart.pageY < 20) && (touchstart.pageY - touchmove.pageY < 20)) {
      $(this).addClass('disabled');
    }
  });
}

function renderNearby() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        console.log(1);
        var pos = position;
        url = '/bdb/search/geo/point?radius=50&lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude;
        console.log(url);
        fetchJSON(url, function(response) {
          console.log(response);
          $('.pull-right').prepend('<li class="brand">' + response.totalResults + '</li>');
          var output = '';
          $(response.data).each(function() {            
            output += handlebarIt('#location-li-tpl', {obj: this});
          });
          $('.stage-center .content-inner').html('<ul class="result-ul">' + output + '</ul>');
          iscrollIt('.stage-center .content');
        });
      },
      function(e) {
        console.log(2);
      }
    );
} 
}

function initialize() {
  $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
  $('body').on('touchstart.dropdown', '.dropdown-menu', function (e) { e.stopPropagation(); }); //make bootstrap dropdowns work on touch devices

  //register leftrail events
  $('body').append(handlebarIt('#leftrail-tpl'));
  renderBookmarks();
  $('#leftrail a').click(function() {
    $('#leftrail li.active').removeClass('active');
  });
  iscrollIt('#leftrail');
  
  $(document).click(function(e) {
    console.log(e);
  });
}




initialize();
});

