// jspoppyseed

// jq fns used: remove, attr, val, clone, each, is, live

var development_mode = (location.protocol == 'file:');

window.onerror = function (msg, uri, line) {
  report_error(msg, null, uri + ": " + line);
  return false; // don't suppress the error
};

window.fbAsyncInit = function() {
  FB.Event.subscribe('auth.sessionChange', function(response) {
    if (response.session) $('body').addClass('fb_authed');
    else $('body').removeClass('fb_authed');
  });
  
  FB.Event.subscribe('auth.logout', function(response) {
    App.fb_logout && App.fb_logout();
  });
  
  FB.init({appId: '31986400134', apiKey: 'cbaf8df3f5953bdea9ce66f77c485c53', status: true, cookie: true, xfbml: true});
  
  FB.getLoginStatus(function(response){
    if (response.session) {
      App.fb_active_on_startup && App.fb_active_on_startup(response.session.uid)
    } else {
      FB.Event.subscribe('auth.login', function(response) {
        App.fb_login && App.fb_login(response.session.uid);
      });
    }
    
  });
};

function report_error (msg, e, place) {
  console.log(e);
  var report = msg + " at " + place;
  if (e) report += "\nException: " + e;
  if (window.printStackTrace && e) 
    report += '\nStack trace:\n' + printStackTrace({e:e}).join('\n') + '\n\n';
  console.log(report);
  $.post('/api/bugreport', {issue: report}, function(){
    App.notify_error && App.notify_error();
  });
}

$.templates = {};
$.template = function(sel){
  if ($.templates[sel] === null) return;
  if ($.templates[sel]) return $.templates[sel].clone();
  var template = $(sel).remove();
  if (template[0]) $.templates[sel] = template;
  else $.templates[sel] = null;
  return $.template(sel);
};

$.fn.validate_form_element = function(obj){
  var name = this.attr('name');
  var title = this.attr('title');
  var required = this.attr('required');
  var pattern = this.attr('pattern');
  var value = this.val();
  if (required && !value) return (obj.error = (title || name) + ".  This required element is missing.");
  if (pattern && !value.match(pattern)) return (obj.error = (title || name) + ".  This element doesn't look right.");
  obj[name] = value;
};

$.fn.form_values = function() {
  var obj = {};
  $.each(this.get(0).elements, function(){
    var el = this;
    if (!el.name || $(el).is('.prompting')) return;
    switch(el.type) {
      case "radio": // fall through
      case "checkbox":
        if (el.checked) obj[el.name] = el.value;
        break;
      case "file":
        // TODO: handle file uploads
        break;
      default:
        $(el).validate_form_element(obj);
    };
  });
  return obj;
};

var jqplus_activations = {};

$.fn.activate = function(space){
  if (jqplus_activations[space]) jqplus_activations[space].removeClass('active');
  jqplus_activations[space] = this.addClass('active');
  return this;
};

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
$.cookie = function(name, value) {
  if (typeof value != 'undefined') { 
    document.cookie = [name, '=', encodeURIComponent(value)].join('');
  } else { 
    if (!document.cookie || document.cookie == '') return null;
    var cookies = document.cookie.split('; ');
    for (var i in cookies) {
      if (cookies[i].split) {
        var part = cookies[i].split('=');
        if (part[0] == name) return decodeURIComponent(part[1].replace(/\+/g, ' '));
      }
    }
    return null;
  }
};

function dispatch(method, args) {
  var chain = [].concat(This.first_responders, LiveHTML.widgets, App);
  var args = $.makeArray(arguments);
  var method = args.shift();
  if (method.indexOf('(') >= 0) { //}){
    var part = method.split("("); //)
    var method = part[0];
    var new_args = eval('([' + part[1].slice(0,-1) + '])');
    args = new_args.concat(args);
  }
  for(var i=0; i<chain.length; i++){
    if(chain[i][method]) return chain[i][method].guarded_apply(chain[i], args);
  }
};

function trigger(method, args) {
  var chain = [].concat(This.first_responders, LiveHTML.widgets, App);
  var args = $.makeArray(arguments);
  var method = args.shift();
  $.each(chain, function(){
    if (this[method]) this[method].apply(this, args);
  });
};


var This = { first_responders: [{}, {}], user: { tag: 'pAnon'} };

$(function(){
  $('a[href],img[href],dl[href],li[href],div[href],h2[href]').live('click', function(){
    var href = $(this).attr('href');
    if (!href || href.charAt(0) != "#") {
      if (this.nodeName == 'A') return true;
      else return window.location = href;
    }
    if ($(this).is('.toggles.active')) {
      go('tool=');
      return false;
    }
    go(href.slice(1), null, this);
    return false;
  });
  
  $('form').live('submit', function(){
    var data = $(this).form_values();
    if (data.error) {
      alert(data.error);
      return false;
    }
    $(this).disable();
    var result = dispatch(this.id + "_submitted", data, This, this);
    if (result != "redo") {
      $(this).find('input[type=text],textarea').each(function(){ this.value = null; });
    }
    $(this).enable();
    return false;
  });
  
  if (FB.init) { window.fbAsyncInit(); }
  
  if((navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPod/i))) {
    $('body').addClass('ios');
  }
});

LiveHTML = { widgets: [] };

$.fn.app_paint = function(){
  var data = {};
  function value_for(method){
    if (!data[method]) data[method] = This[method] || dispatch(method, This);
    return data[method] || window[method];
  };
  this.find('[observe]').each(function(){
    var obj = $(this);
    var methods = obj.attr('observe').split(' METHOD_SPACER ');
    obj.change(function(){
      $.each(methods, function(i, method) { dispatch(method, obj.val(), null, obj); });
      return true;
    });
    obj.keydown(function(e){
      var ch = String.fromCharCode(e.which);
      $.each(methods, function(i, method) { dispatch(method, obj.val(), ch, obj); });
      return true;
    });
  });
  this.find('input[hint],textarea[hint]').each(function(){
    var self = $(this);
    var hint = self.attr('hint');
    if (hint.charAt(0) == '#') hint = dispatch(hint.slice(1));
    self.val(hint).addClass('prompting');
    self.focus(function(){ 
      if (self.is('.prompting')) self.val('').removeClass('prompting'); 
    });
    self.blur(function(){ if (!self.val()) self.val(hint).addClass('prompting'); });
  });
  this.find('[fill]').each(function(){
    var obj = $(this);
    var parts = obj.attr('fill').split(' ');
    var method = parts[0];
    var attr = parts[1];
    var value = value_for(method);
    if (typeof value.valueOf() == 'string') {
      if (attr) obj.attr(attr, value);
      else      obj.html(value);
    } else {
      console.log("Value ["+value+"] is not an instance of string");
    }
  });
  this.find('[if]').each(function(){
    var obj = $(this);
    var method = obj.attr('if');
    var reverse = false;
    if (method.charAt(0) == '!') {
      method = method.slice(1);
      reverse = true;
    }
    var value = value_for(method);
    if (reverse) value = !value;
    if (value) obj.show();
    else obj.hide();
  });

  this.find('input.focus').focus();
  return this;
};

Function.prototype.guarded_apply = function(obj, args){
  if (development_mode) return this.apply(obj, args);
  else try {
    this.apply(obj, args);
  } catch(e) {
    report_error('error during go(url): ' + url, e);
  }
};

function go(url, form_data, elem) {
  if (url == '#' || url == '' || url == '@') return;    
  if (url.charAt(0) == '@') return App.at_link(url);
  if (url.charAt(0) == '#') {
    var parts = url.slice(1).split('?');
    return dispatch(parts[0], unescape(parts[1]), elem);
  }

  console.log('go('+url+')');

  This.form_data = form_data;
  var changed = This.changed = {};
  This.prev_url = This.url;
  This.url = url;
  $.each(url.split(';'), function(){
    var part = this.split('=');
    set(part[0], unescape(part[1]));
  });

  if (!This.prev_url) changed.tool = true;

  (function(){
    if (changed.tool) {
      $('.' + This.tool + '_tool').activate('tool');
      go('#tool_unselected');
      This.first_responders[0] = (App.tools && App.tools[This.tool]) || {};
      go('#tool_selected');
    }
    if (App.update) App.update(This.changed);
    $('.hud:visible, .magic').app_paint();
  }).guarded_apply(this);

  App.loaded = true;
};


function set(key, value) {
  if (This[key] != value) {
    This.changed[key] = true;
    This[key] = value;
  }
};
