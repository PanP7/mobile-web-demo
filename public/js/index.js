window.addEventListener('load', function() {
  new FastClick(document.body);
}, false);


jQuery(function($){

var Util = {
  init: function() {
    Util.hb = {};
    Util.iscrolls = {};
    Util.fetchCache = {};
  },
  
  handlebarIt: function(selector, args) {
    if (!Util.hb[selector]) {
      Util.hb[selector] = Handlebars.compile($(selector).html());
    }
    return Util.hb[selector](args);
  },
  
  iscrollIt: function(selector) {
    if (Util.iscrolls[selector] != null) Util.iscrolls[selector].destroy();
    Util.iscrolls[selector] = new iScroll(
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
  },
  
  fetchJSON: function(url, callback, secondsToCache) {
    secondsToCache = secondsToCache ? secondsToCache : 60*60; //default to one hour
    var nowInSeconds = Math.round(new Date().getTime() / 1000);
    if (!Util.fetchCache[url] || ((Util.fetchCache[url].timestamp + secondsToCache) < nowInSeconds)) {
      $.getJSON(url, function(response) {
        Util.fetchCache[url] = {response: response, timestamp: nowInSeconds};
        callback(Util.fetchCache[url].response);
      });
    }
    else {
      callback(Util.fetchCache[url].response);
    }
  },
  
  getJSON: function(itemName) {
    var item = JSON.parse(window.localStorage.getItem(itemName))
    return !item ? {} : item; 
  },

  setJSON: function (itemName, item) {
    window.localStorage.setItem(itemName, JSON.stringify(item));
  }
}
Util.init();

var PageMan = {  
  init: function() {
    PageMan.direction = '';
    
    $('body').on('touchstart.dropdown', '.dropdown-menu', function (e) { e.stopPropagation(); }); //make bootstrap dropdowns work on touch devices

    //render leftrail
    $('body').append(Util.handlebarIt('#leftrail-tpl'));
    renderBookmarks();
    $('#leftrail a').click(function() {
      $('#leftrail li.active').removeClass('active');
    });
    Util.iscrollIt('#leftrail');
  },
  
  loadPage: function(pageTitle, pageClass, args) {
    var page = $(Util.handlebarIt("#page-tpl", {pageClassName: pageClass, pageTitle: pageTitle}));
    this.changePage(page);
    window.setTimeout.apply(null, args);
  },
  
  changePage: function(newPage) {
    $('.stage-right, .stage-left').remove(); // Cleaning up: remove old pages that were moved out during the previous changePage
    var oldPage = $('.stage-center');
    var newPageStartingClasses = 'page stage-right';
    var newPageFinalClasses = 'page stage-center animation';
    var oldPageFinalClasses = 'page stage-left animation';

    //determine transition classes
    if ($(oldPage).hasClass('leftrail-enabled')) { //if menu is open, only animate the menu close
      newPageStartingClasses = 'page stage-center leftrail-enabled animation';
      oldPageFinalClasses = 'page stage-left';
    }
    else if (oldPage.length == 0 || PageMan.direction == '') { //if no direction is set, add it without animation
      newPageStartingClasses = 'page stage-center';
      oldPageFinalClasses = 'page stage-left';
    }
    else if (PageMan.direction == 'backward') {
      newPageStartingClasses = 'page stage-left';
      oldPageFinalClasses = 'page stage-right animation';
    }
    PageMan.direction = ''; //reset direction for the next call to changePage

    //do the transition
    $(newPage).attr('class', newPageStartingClasses);
    $('body').append(newPage);
    setTimeout(function() { // Wait until the new page has been added to the DOM...
        $(oldPage).attr('class', oldPageFinalClasses);
        $(newPage).attr('class', newPageFinalClasses);
        PageMan.registerPageEvents(newPage);
    });
  },
  
  registerPageEvents: function(page) {          
    $(page).bind('touchstart mousedown', function(){
      $(this).removeClass('leftrail-enabled');
    });

    $('.backlink, .brand').bind('touchstart mousedown', function(e) {
      if (Backbone.history.fragment == '' || Backbone.history.fragment.indexOf('search') == 0) {
        $('.stage-center').toggleClass('leftrail-enabled');
      }
      else {
        PageMan.goHistory(-1);      
      }
      return false;
    });
    
    $('.menulink').bind('touchstart mousedown', function(e){
      $('.stage-center').toggleClass('leftrail-enabled');
      return false;
    });

    var touchstart;
    $(page).bind('touchstart', function(e){
      touchstart = e.originalEvent.touches[0];
    }).bind('touchmove', function(e) {//alert(touchstart + '|' + e.touches[0].pageX);
      var touchmove = e.originalEvent.touches[0];
      if (touchmove.pageX > touchstart.pageX + 50 && (touchmove.pageY - touchstart.pageY < 20) && (touchstart.pageY - touchmove.pageY < 20)) {
        $(this).addClass('leftrail-enabled');
      }
    });
  },
  
  goForward: function(loc) {
    PageMan.direction = 'forward';
    window.location = $(this).attr('href');
    return false;
  },
  
  goHistory: function (step) {
    PageMan.direction = step < 0 ? 'backward' : 'forward';
    window.history.go(step);
  },
  
  registerContentEvents: function() {
    Util.iscrollIt('.stage-center .content'); //
    
    //indicate forward transition before changing location
    $('.stage-center *[href]').click(this.goForward);
  }
}
PageMan.init();

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
      PageMan.loadPage('Search', 'home-page', [renderSearchForm, 300]);
    },
    listPage: function (name) {
      PageMan.loadPage(name, 'list-page', [renderListContent, 1200, name]);
    },
    itemPage: function (name, id) {
      PageMan.loadPage(name + ' ' + id, 'item-page', [renderItemContent, 4000, name, id]);
    },
    resultsPage: function(scope, query) {
      PageMan.loadPage('Search: ' + query, 'results-page', [renderResults, 0, scope, query]);
    },
    beerPage: function(id) {
      PageMan.loadPage('', 'beer-page', [renderResult, 0, 'beer', id])
    },
    breweryPage: function(id) {
      PageMan.loadPage('', 'brewery-page', [renderResult, 0, 'brewery', id])
    },
    bdbLog: function(splat) {
      Util.fetchJSON('/bdb/' + splat, function(response) { console.log(response); });
    },
    nearbyPage: function() {
      PageMan.loadPage('Nearby Breweries', 'nearby-page', [renderNearby, 0])
    }
});
var appRouter = new AppRouter();
Backbone.history.start();

function renderSearchForm(scope, query) {
  scope = scope ? scope : 'all';
  query = query ? query : '';
  $('.stage-center .content-inner').html(Util.handlebarIt("#search-form-tpl", {query: query}));
  $('.search-scope li a').click(function(e) {
    $('.search-scope li.active').removeClass('active');
    $(this).parent().addClass('active');
    var sourceElement = this;
    $('#search-input').each(function() {
      $(this).attr('placeholder', $(sourceElement).attr('data-placeholder'));
      if ($(this).val() != '') {
        scope = $(sourceElement).attr('data-scope');
        query = $(this).val();
        //PageMan.loadPage('Search: ' + query, 'results-page', [renderResults, 0, scope, query])
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
  PageMan.registerContentEvents();
}

function renderResults(scope, query) {
  renderSearchForm(scope, query);
  var el = $('.stage-center .content-inner');
  $(el).append('<ul class="list-wrap"><p id="loading"><span>.</span><span>.</span><span>.</span></p></ul>');
  var url = "/bdb/search?withBreweries=Y&q=" + query;
  if (scope == 'beers') url += '&type=beer';
  else if (scope == 'breweries') url += '&type=brewery';
  Util.fetchJSON(url, function(response) {
    console.log(response);
    var output = '';
    $('.pull-right').prepend('<li class="brand">' + response.totalResults + '</li>');
    $(response.data).each(function() {
      var tpl = this.type == 'brewery' ? '#brewery-li-tpl' : '#beer-li-tpl';
      output += Util.handlebarIt(tpl, {obj: this});
    });
    $('.list-wrap', el).html(output);
    PageMan.registerContentEvents();
  });
}

function renderResult(type, id) {
  Util.fetchJSON("/bdb/" + type + "/" + id + "?withBreweries=Y", function(response) {
    console.log(response);
    var el = $('.stage-center .content-inner');
    $(el).html(Util.handlebarIt("#"+ type + "-tpl", {obj: response.data}));
    $('.brand').html(response.data.name);
    renderBookmarkLink(type, id, response.data.name);            
    if (type == 'brewery') {
      $(el).append('<ul class="list-wrap"><p id="loading"><span>.</span><span>.</span><span>.</span></p></ul>');
      var output = '';
      Util.fetchJSON("/bdb/" + type + "/" + id + "/beers?withBreweries=Y", function(response) {
        $(response.data).each(function() {
          output += Util.handlebarIt('#beer-li-tpl', {obj: this});
        });
        $('.list-wrap', el).html(output);
        PageMan.registerContentEvents();
      });
    }
    else if (type == 'beer') {
      var output = '';
      $(response.data.breweries).each(function() {
        output += Util.handlebarIt('#brewery-li-tpl', {obj: this});
      });
      $('.breweries', el).html('<ul class="list-wrap">' + output + '</ul>');
    }
    PageMan.registerContentEvents();
  });
}

function renderBookmarkLink(type, id, name) {
  var bookmarks = Util.getJSON('bookmarks');
  var path = type + '/' + id;
  var icon = $('.marklink i');
  var link = $('.marklink');
  
  $(icon).attr('class', bookmarks[path] ? 'icon-star' : 'icon-star-empty');
  $(icon).html(bookmarks[path] ? '+' : '-');
  $(link).click(function() {
    if (!bookmarks[path]) {
      bookmarks[path] = {id: id, name: name, type: type, path: path}; 
      Util.setJSON('bookmarks', bookmarks);
      renderBookmarks();
      renderAlert('Bookmark added.', this);
      $(icon).attr('class', 'icon-star');
      $(icon).html('+');
    }
    else {
      delete bookmarks[path];
      Util.setJSON('bookmarks', bookmarks);
      renderBookmarks();
      renderAlert('Bookmark removed.', this);              
      $(icon).attr('class', 'icon-star-empty');
      $(icon).html('-');
    }
  });
}

function renderAlert(text, el) {
  /*
  $(el).tooltip({
     placement: 'bottom',
     title: text,
     trigger: 'manual',
     delay: 500
  });
  $(el).tooltip('show');
  window.setTimeout(function() { $(el).tooltip('destroy'); }, 1000);          
  */
}


function renderBookmarks() {
  $('#bookmarks').html(Util.handlebarIt('#bookmark-li-tpl', {bookmarks: Util.getJSON('bookmarks')}));
}



function renderNearby() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        console.log(1);
        var pos = position;
        var url = '/bdb/search/geo/point?radius=50&lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude;
        console.log(url);
        Util.fetchJSON(url, function(response) {
          console.log(response);
          $('.pull-right').prepend('<li class="brand">' + response.totalResults + '</li>');
          var output = '';
          $(response.data).each(function() {            
            output += Util.handlebarIt('#location-li-tpl', {obj: this});
          });
          $('.stage-center .content-inner').html('<ul class="list-wrap">' + output + '</ul>');
          PageMan.registerContentEvents();
        });
      },
      function(e) {
        console.log(2);
      }
    );
  } 
}

function renderListContent(text) {
  var content = '';
  for (var i = 0; i < 50; i++) content += '<li><a href="#item/' + text + '/' + i + '"><i class="icon-chevron-right"></i>' + text + ' ' + i + '</a></li>'
  content = '<ul class="nav nav-tabs nav-stacked">' + content + '</ul>';
  $('.stage-center .content-inner').html(content);
  iscrollIt('.stage-center .content');
}
                
function renderItemContent(text) {
  var content = '';
  for (var i = 0; i < 1000; i++) content += '' + text + ' ';
  $('.stage-center .content-inner').html(content);
  iscrollIt('.stage-center .content');
}

});

