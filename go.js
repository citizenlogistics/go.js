// jq fns used: remove, attr, val, clone, each, is, live

if (!window.console) window.console = {};
if (!window.console.log) console.log = function(x){};
var This = { changed:{} };

$.extend(String.prototype, {
  capitalize: function() {
      return this.charAt(0).toUpperCase() + this.slice(1);
  }
});


// ============
// = basic go =
// ============

(function(){
  var go = function(url) {
    var parts = url.split(' ');
    if (parts.length > 1) { url = parts.shift(); This.stack = parts; }
    This.new_url = url;
    go.trigger('will_change_state');
    if (!This.new_url) return;
    This.url = This.new_url;
    $.each(This.url.split(';'), function(){
      var p = this.split('=');
      go.set(p[0], unescape(p[1]));
    });
    go.trigger('change_state');
    go.trigger('did_change_state');
    This.changed = {};
  };

  var handlers = [];
  var handler_positions = {};
  go.NOT_FOUND = {};

  $.extend(go, {
    sender: function(argses){
      var args = $.makeArray(argses);
      var method = args.shift();
      if (method.indexOf('(') >= 0) { //}){
        var part = method.split("("); //)
        var method = part[0];
        var new_args = eval('([' + part[1].slice(0,-1) + '])');
        args = new_args.concat(args);
      }
      return function(obj){
        var fn = obj[method];
        if (!fn) return go.NOT_FOUND;
        if (go.dev || window.throw_errors) return fn.apply(obj, args);
        else {
          try { return fn.apply(obj, args); }
          catch(e) { go.err('error: ', e, "for method " + method + " and args " + args); }
        }
      };
    },

    value: function(method, args) {
      var sender = go.sender(arguments);
      for(var i=0; i<handlers.length; i++){
        var result = sender(handlers[i]);
        if (result !== go.NOT_FOUND) return result;
      }
      return go.NOT_FOUND;
    },
    
    exists: function(method) {
      for(var i=0; i<handlers.length; i++){
        if (handlers[i][method]) return true;
      }
      return false;
    },
    
    onwards: function() {
      if (!This.stack || This.stack.length == 0) return;
      go(This.stack.shift());
    },

    dispatch: function(method, args) {
      console.log('dispatch: ' + method); // use a debug log level
      var result = go.value.apply(go, arguments);
      if (result === go.NOT_FOUND) return false;
      else return true;
    },

    trigger: function(method, args) {
      // console.log('trigger: ' + method); // use a debug log level
      var sender = go.sender(arguments);
      $.each(handlers, function(){ sender(this); });
    },

    set: function(key, value) {
      if (This[key] == value) return;
      This.changed[key] = true;
      This[key] = value;
    },

    install: function(name, obj) {
      handler_positions[name] = (handler_positions[name] || handlers.length);
      handlers[handler_positions[name]] = obj;
    },

    push: function(obj) {
      handlers.push(obj);
    },

    f: function(where){
      return function(){ go(where); };
    },

    err: function(msg, e, place) {
      if (This.bugreport) return;
      This.bugreport = msg + " at " + place;
      if (e) {
        console.log(e);
        This.bugreport += "\nException: " + e;
        if (window.printStackTrace)
          This.bugreport += '\nStack trace:\n' + printStackTrace({e:e}).join('\n') + '\n\n';
      }
      console.log(This.bugreport);
      go.trigger('report_error');
      This.bugreport = null;
    }
  });

  window.go = go;
})();



// ============================
// = Some basic go extensions =
// ============================

go.install('url_handling', {
  will_change_state: function() {
    if (!This.new_url) return;
    var c1 = This.new_url.charAt(0);
    if (c1 != '#' && c1 != '@') return;
    if (c1 == '#') {
      go.dispatch(This.new_url.slice(1));
    } else if (c1 == '@') {
      go.dispatch('at_item');
    }
    This.new_url = null;
  }
});

go.install('tool_handler', {
  change_state: function() {
    if (!This.changed.tool) return;
    go('#tool_unselected');
    go.install('tool', (App.tools && App.tools[This.tool]) || {});
    go('#tool_selected');
  },
  start: function() {
    This.changed.tool = true;
  }
});

go.install('body_classes', {
  start: function() {
    if (!This.dom_ready || This.body_classes_initialized) return;
    if((navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPod/i))) {
      $('body').addClass('ios mobile webkit');
    } else if((navigator.userAgent.match(/Mobile Safari/i))) {
      $('body').addClass('mobile webkit');
    } else if((navigator.userAgent.match(/BlackBerry/i))) {
      $('body').addClass('mobile blackberry');
    } else if((navigator.userAgent.match(/Opera (Mini|Mobi)/i))) {
      $('body').addClass('mobile opera');
    }
    $("body").bind("ajaxSend", function(){
      $(this).addClass('refresh');
    }).bind("ajaxComplete", function(event, req, settings){
      $(this).removeClass('refresh');
    });
    This.body_classes_initialized = true;
  }
});


// ============
// = FACEBOOK =
// ============

(function(){
  function fbstart() {
    function fb_logout(response) { 
      $('body').removeClass('fb_authed');
      go.dispatch('facebook_logout') || window.location.reload();
    }
    
    function fb_login(response) {
      This.facebook_uid = response.session.uid;
      This.login_after_page_load = true;
      $('body').addClass('fb_authed');
      go.trigger('facebook_login');
    };

    FB.getLoginStatus(function(response){
      if (response.session) {
        This.facebook_uid = response.session.uid;
        FB.Event.subscribe('auth.logout', fb_logout);
        $('body').addClass('fb_authed');
      }
      else {
        FB.Event.subscribe('auth.login', fb_login);
        $('body').removeClass('fb_authed');
      }
      go.trigger('facebook_ready');
    });
  };

  if (!window.FB) window.fbAsyncInit = fbstart;
  else fbstart();
})();



// =====================
// = jquery extensions =
// =====================

$.templates = {};
$.template = function(sel){
  if ($.templates[sel] === null) return;
  if ($.templates[sel]) return $.templates[sel].clone();
  var template = $(sel).remove();
  if (template[0]) $.templates[sel] = template;
  else $.templates[sel] = null;
  return $.template(sel);
};

$.fn.store_form_value = function(obj) {
  var name = this.attr('name');
  if (/\[\]$/.test(name)) {
    obj[name] = obj[name] || [];
    obj[name].push(this.val());
  } else {
    obj[name] = this.val();
  }
};

$.fn.validate_form_element = function(obj){
  var name = this.attr('name');
  var title = (this.attr('title') || name || '').capitalize();
  var required = (!(this.attr('required') === false) || (this.attr('required') === undefined));
  var pattern = this.attr('pattern');
  var regex = pattern && new RegExp(pattern);
  var value = this.val();
  if (required && !value) return (obj.error = title + " is missing.");
  if (!value) return;
  if (regex && !value.match(regex)) return (obj.error = title + " doesn't look right.");
  this.store_form_value(obj);
};

$.fn.form_values = function() {
  var obj = {};
  $.each(this.get(0).elements, function(){
    var el = this;
    if (!el.name || $(el).is('.prompting')) return;
    switch(el.type) {
      case "radio": // fall through
      case "checkbox":
        if (el.checked) $(el).store_form_value(obj);
        break;
      case "file":
        // file uploads must be handled separately, e.g. with iframe-post-form
        break;
      default:
        $(el).validate_form_element(obj);
    };
  });
  return obj;
};

(function(){
  
  $.fn.activate = function(space){
    $('[class*=_' + space + '].active').removeClass('active');
    this.addClass('active');
    return this;
  };

})();

$.fn.disable = function(){
  this.find('button,input,select,textarea').attr('disabled', true);
  var subm = this.find('[type=submit]:first')[0];
  return this;
};

$.fn.enable = function(){
  this.find(':disabled').attr('disabled', false);
  return this;
};

// descends from Klaus Hartl's "cookie plugin"
// http://plugins.jquery.com/files/jquery.cookie.js.txt
$.cookie = function(name, value, options) {
  if (typeof value != 'undefined') {
    options = options || {};
    if (value === null) {
        value = '';
        options.expires = -1;
    }
    var expires = '';
    if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
        var date;
        if (typeof options.expires == 'number') {
            date = new Date();
            date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
        } else {
            date = options.expires;
        }
        expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
    }
    // CAUTION: Needed to parenthesize options.path and options.domain
    // in the following expressions, otherwise they evaluate to undefined
    // in the packed version for some reason...
    var path = options.path ? '; path=' + (options.path) : '';
    var domain = options.domain ? '; domain=' + (options.domain) : '';
    var secure = options.secure ? '; secure' : '';
    document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
  } else {
    if (!document.cookie || document.cookie == '') return null;
    var cookies = document.cookie.split('; ');
    for (var i in cookies) {
      if (cookies[i].split) {
        var part = cookies[i].split('=');
        if (part[0] == name) return decodeURIComponent(part[1] && part[1].replace(/\+/g, ' ') || '');
      }
    }
    return null;
  }
};


// =======================
// = set up live() calls =
// =======================

$('a[href],img[href],dl[href],li[href],div[href],h2[href],h3[href]').live('click', function (e){
  var href = $(this).attr('href');
  if (!href || href.charAt(0) != "#") {
    if (this.nodeName == 'A') return true;
    else return window.location = href;
  }
  This.clicked = this;
  This.event = e;
  var go_url = href.slice(1);
  if ($(this).is('.toggles.active')) go_url = go_url.replace(/=.*/, '=');
  go(go_url);
  return false;
});

$('[sets]').live('change', function(){
  var sets = $(this).attr('sets');
  go(sets + '=' + this.value);
  return true;
});

$('form').live('submit', function(){
  var goes = $(this).attr('goes');
  var form_name = this.id || '';
  if (!goes && !go.exists(form_name + "_submitted")) return true;

  This.form_data = $(this).form_values();
  if (This.form_data.error) {
    alert(This.form_data.error);
    return false;
  }
  if (goes) { go(goes); return false; }
  
  $('input', this).blur();
  $(this).disable();

  // this is old, deprecated code
  var result = go.value(this.id + "_submitted", This.form_data, This, this);
  if (result != "redo") {
    $(this).find('input[type=text],input[type=password],textarea').each(function(){ this.value = null; });
  }
  $(this).enable();
  return result == go.NOT_FOUND;
});



// ==============
// = repainting =
// ==============

(function(){

  go.push({
    did_change_state: function() {
      for (var thing in This.changed) {
        var value = This[thing];
        if (value !== undefined && value !== null && typeof value.valueOf() == 'string') {
          var sel = '.' + This[thing] + '_' + thing;
          // TODO: only run this if sel and thing are valid
          try { $(sel).activate(thing); } catch(e) {}
        }
      }
      $('.hud:visible, .modal:visible, .magic').app_paint();
      console.log('go('+This.url+')');
    }
  });

  function scanner(){
    var data = {};
    return function(method){
      var reverse = false;
      if (method.charAt(0) == '!'){
        method = method.slice(1);
        reverse = true;
      }

      var result, gval;
      if (data[method])      result = data[method];
      else if (This[method]) result = data[method] = This[method];
      else if ((gval = go.value(method, This)) && gval !== go.NOT_FOUND) result = data[method] = gval;
      if (!result) result = window[method];
      if (reverse) result = !result;
      return result;
    };
  }

  $.fn.app_paint = function(){
    var value_for = scanner();

    // TODO: refactor as live() and degrade HTML5 'placeholder' attr
    this.find('input[hint],textarea[hint]').each(function(){
      var self = $(this);
      var hint = self.attr('hint');
      if (hint.charAt(0) == '#') hint = go.value(hint.slice(1));
      if (!self.is('.focused')) self.val(hint).addClass('prompting');
      
      self.focus(function(){
        if (self.is('.prompting')) self.val('').removeClass('prompting');
        self.addClass('focused');
      });
      self.blur(function(){ 
        if (!self.val()) self.val(hint).addClass('prompting'); 
        self.removeClass('focused');
      });
    });


    // TODO: refactor as live()
    this.find('[observe]').each(function(){
      var obj = $(this);
      var method = obj.attr('observe');
      go.dispatch(method, obj.val(), null, obj);

      obj.change(function(){
        go.dispatch(method, obj.val(), null, obj);
        return true;
      });
      obj.keydown(function(e){
        var ch = String.fromCharCode(e.which);
        go.dispatch(method, obj.val(), ch, obj);
        return true;
      });
    });


    this.find('[fill]').each(function(){
      var obj = $(this);
      var parts = obj.attr('fill').split(' ');
      var method = parts[0];
      var attr = parts[1];
      var value = value_for(method);
      if (!value && !attr) return obj.hide();
      else obj.show();
      if (!value) return;
      if (value.valueOf() instanceof RegExp) value = value.source;
      if (typeof value.valueOf() == 'string') {
        value = value.valueOf();
        obj.removeClass('prompting');
        if (attr) obj.attr(attr, value);
        else      obj.html(value);
      } else {
        console.log("The following value is not an instance of string:");
        console.log(value);
      }
    });
    this.find('[if]').each(function(){
      var obj = $(this);
      var method = obj.attr('if');
      if (value_for(method)) obj.show();
      else obj.hide();
    });

    this.find('input.focus').focus();

    return this;
  };
})();


$(function(){ This.dom_ready = true; go.trigger('start'); });
window.onerror = function (msg, uri, line) { go.err(msg, null, uri + ": " + line); return false; };
