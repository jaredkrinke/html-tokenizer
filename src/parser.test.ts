/* eslint-disable no-irregular-whitespace */
import { Parser, Attributes, ParseToken, TextParseToken } from './parser';
import * as assert from 'assert';
import cheerio from 'cheerio';
import entityMap from './entities';
import { Entities } from './types';

interface TestDescr {
  html: string;
  events: string;
  entities?: Entities;
}

describe('html-tokenizer/parser', () => {

  const tests: TestDescr[] = [{html: '', events: ''},
    {html: '<br>', events: 'open,br,{},true,close,br,true'},
    {html: '<br/>', events: 'open,br,{},true,close,br,true'},
    {html: '<p>', events: 'open,p,{},false,close,p,false'},
    {html: '<p>hello', events: 'open,p,{},false,text,hello,close,p,false'},
    {html: '<p/>hello', events: 'open,p,{},true,close,p,true,text,hello'},
    {html: '<b><i><u>', events: 'open,b,{},false,open,i,{},false,open,u,{},false,close,u,false,close,i,false,close,b,false'},
    {html: '<b><i><u></u></i></b>', events: 'open,b,{},false,open,i,{},false,open,u,{},false,close,u,false,close,i,false,close,b,false'},
    {html: '<b><i>what<u></u></i></b>', events: 'open,b,{},false,open,i,{},false,text,what,open,u,{},false,close,u,false,close,i,false,close,b,false'},
    {html: '<br>foo</br>', events: 'open,br,{},true,close,br,true,text,foo'},
    {html: '<br class="xyz">', events: 'open,br,{"class":"xyz"},true,close,br,true'},
    {html: '<br id=" foo-bar" class="xyz">', events: 'open,br,{"id":" foo-bar","class":"xyz"},true,close,br,true'},
    {html: '<br id=\' foo-bar\' class=\'xyz\'>', events: 'open,br,{"id":" foo-bar","class":"xyz"},true,close,br,true'},
    {html: '<br id=foo-bar class=xyz>', events: 'open,br,{"id":"foo-bar","class":"xyz"},true,close,br,true'},
    {html: '<br id\n   \t=\r\nfoo-bar class\n=\txyz>', events: 'open,br,{"id":"foo-bar","class":"xyz"},true,close,br,true'},
    {html: '<br>>>', events: 'open,br,{},true,close,br,true,text,>>'},
    {html: '<<<br>', events: 'text,<<,open,br,{},true,close,br,true'},
    {html: '<b></b></pre>', events: 'open,b,{},false,close,b,false'},
    {html: '<b></b></pre>hello', events: 'open,b,{},false,close,b,false,text,hello'},
    {html: '<b></pre>', events: 'open,b,{},false,close,b,false'},
    {html: '<pre', events: ''},
    {html: '<pre ', events: 'text, '},
    {html: 'zz<pre', events: 'text,zz'},
    {html: '< br>', events: 'text,< br>'},
    {html: '</br>', events: ''},
    {html: '<!---->', events: 'comment,'},
    {html: '<!--x-->', events: 'comment,x'},
    {html: '<!--\nx\n-->', events: 'comment,\nx\n'},
    {html: '<!--x-- >', events: 'comment,x-- >'},
    {html: '<foo:bar>', events: 'open,foo:bar,{},false,close,foo:bar,false'},
    {html: '</foo:bar>', events: ''},
    {html: '<foo:bar></foo:bar>', events: 'open,foo:bar,{},false,close,foo:bar,false'},
    {html: '<foo:bar yes="yes"></foo:bar>', events: 'open,foo:bar,{"yes":"yes"},false,close,foo:bar,false'},
    {html: '<script type="text/javascript"></script>', events: 'open,script,{"type":"text/javascript"},false,close,script,false'},
    {html: '<script>alert("hello")</script>', events: 'open,script,{},false,text,alert("hello"),close,script,false'},
    {html: '<script>for (var n=10,i=0; i<n; i++);</script>', events: 'open,script,{},false,text,for (var n=10,i=0; i<n; i++);,close,script,false'},
    {html: '<script>\nfor (var n=10,i=0; i<n; i++);\n</script>', events: 'open,script,{},false,text,\nfor (var n=10,i=0; i<n; i++);\n,close,script,false'},
    {html: '<script><foo<foo<foo</script>', events: 'open,script,{},false,text,<foo<foo<foo,close,script,false'},
    {html: '<script><![CDATA[ blah >> ></script>', events: 'open,script,{},false,text,<![CDATA[ blah >> >,close,script,false'},
    {html: '<script><!--//--></script>', events: 'open,script,{},false,text,<!--//-->,close,script,false'},
    {html: '<script>\n<!--\n//-->\n</script>', events: 'open,script,{},false,text,\n<!--\n//-->\n,close,script,false'},
    {html: '<script>alert("</script>")</script>', events: 'open,script,{},false,text,alert(",close,script,false,text,")'},
    {html: '<script>alert("</scr"+"ipt>")</script>', events: 'open,script,{},false,text,alert("</scr"+"ipt>"),close,script,false'},
    {html: '<script defer>', events: 'open,script,{"defer":""},false,close,script,false'},
    {html: '<foo<foo<foo/>', events: 'open,foo,{},true,close,foo,true'},
    {html: '<foo<foo<foo/>>>', events: 'open,foo,{},true,close,foo,true,text,>>'},
    {html: '<br att=\'yes, "no", yes\'>', events: 'open,br,{"att":"yes, \\"no\\", yes"},true,close,br,true'},
    {html: '<br att=\'margin: 0px; padding: 3px 4px; width: 652px; color: rgb(153, 153, 153); font-family: "Open Sans", Helvetica, Arial, sans-serif; font-size: 11px; display: block;\'>', events: 'open,br,{"att":"margin: 0px; padding: 3px 4px; width: 652px; color: rgb(153, 153, 153); font-family: \\"Open Sans\\", Helvetica, Arial, sans-serif; font-size: 11px; display: block;"},true,close,br,true'},

    //An li element's end tag may be omitted if the li element is immediately followed by another li element or if there is no more content in the parent element.
    {html: '<ul><li></li></ul>a', events: 'open,ul,{},false,open,li,{},false,close,li,false,close,ul,false,text,a'},
    {html: '<ul><li></li><li></li></ul>a', events: 'open,ul,{},false,open,li,{},false,close,li,false,open,li,{},false,close,li,false,close,ul,false,text,a'},
    // ----------------------
    {html: '<ul><li></ul>a', events: 'open,ul,{},false,open,li,{},false,close,li,false,close,ul,false,text,a'},
    {html: '<ul><li><li></ul>a', events: 'open,ul,{},false,open,li,{},false,close,li,false,open,li,{},false,close,li,false,close,ul,false,text,a'},
    {html: '<ul><li>a<li>b</ul>a', events: 'open,ul,{},false,open,li,{},false,text,a,close,li,false,open,li,{},false,text,b,close,li,false,close,ul,false,text,a'},

    //A dt element's end tag may be omitted if the dt element is immediately followed by another dt element or a dd element.
    {html: '<dl><dt></dt><dd></dd></dl>a', events: 'open,dl,{},false,open,dt,{},false,close,dt,false,open,dd,{},false,close,dd,false,close,dl,false,text,a'},
    // ----------------------
    {html: '<dl><dt><dd></dd></dl>a', events: 'open,dl,{},false,open,dt,{},false,close,dt,false,open,dd,{},false,close,dd,false,close,dl,false,text,a'},
    {html: '<dl><dt><dt></dt></dl>a', events: 'open,dl,{},false,open,dt,{},false,close,dt,false,open,dt,{},false,close,dt,false,close,dl,false,text,a'},

    //A dd element's end tag may be omitted if the dd element is immediately followed by another dd element or a dt element, or if there is no more content in the parent element.
    {html: '<dl><dd></dd></dl>a', events: 'open,dl,{},false,open,dd,{},false,close,dd,false,close,dl,false,text,a'},
    {html: '<dl><dd></dd><dd></dd></dl>a', events: 'open,dl,{},false,open,dd,{},false,close,dd,false,open,dd,{},false,close,dd,false,close,dl,false,text,a'},
    // ----------------------
    {html: '<dl><dd></dl>a', events: 'open,dl,{},false,open,dd,{},false,close,dd,false,close,dl,false,text,a'},
    {html: '<dl><dd><dd></dl>a', events: 'open,dl,{},false,open,dd,{},false,close,dd,false,open,dd,{},false,close,dd,false,close,dl,false,text,a'},
    {html: '<dl><dd><dt></dt></dl>a', events: 'open,dl,{},false,open,dd,{},false,close,dd,false,open,dt,{},false,close,dt,false,close,dl,false,text,a'},

    //A p element's end tag may be omitted if the p element is immediately followed by an address, article, aside, blockquote, div, dl, fieldset, footer, form, h1, h2, h3, h4, h5, h6, header, hgroup, hr, main, nav, ol, p, pre, section, table, ul, or if there is no more content in the parent element and the parent element is not an a element.
    {html: '<div><p></p></div><b>', events: 'open,div,{},false,open,p,{},false,close,p,false,close,div,false,open,b,{},false,close,b,false'},
    {html: '<p></p><p></p>', events: 'open,p,{},false,close,p,false,open,p,{},false,close,p,false'},
    {html: '<p><a>', events: 'open,p,{},false,open,a,{},false,close,a,false,close,p,false'},
    {html: '<div><a></div><a>', events: 'open,div,{},false,open,a,{},false,open,a,{},false,close,a,false,close,a,false,close,div,false'},
    // ----------------------
    {html: '<div><p></div><b>', events: 'open,div,{},false,open,p,{},false,close,p,false,close,div,false,open,b,{},false,close,b,false'},
    {html: '<p><address>', events: 'open,p,{},false,close,p,false,open,address,{},false,close,address,false'},
    {html: '<p><article>', events: 'open,p,{},false,close,p,false,open,article,{},false,close,article,false'},
    {html: '<p><aside>', events: 'open,p,{},false,close,p,false,open,aside,{},false,close,aside,false'},
    {html: '<p><blockquote>', events: 'open,p,{},false,close,p,false,open,blockquote,{},false,close,blockquote,false'},
    {html: '<p><div>', events: 'open,p,{},false,close,p,false,open,div,{},false,close,div,false'},
    {html: '<p><dl>', events: 'open,p,{},false,close,p,false,open,dl,{},false,close,dl,false'},
    {html: '<p><fieldset>', events: 'open,p,{},false,close,p,false,open,fieldset,{},false,close,fieldset,false'},
    {html: '<p><footer>', events: 'open,p,{},false,close,p,false,open,footer,{},false,close,footer,false'},
    {html: '<p><form>', events: 'open,p,{},false,close,p,false,open,form,{},false,close,form,false'},
    {html: '<p><h1>', events: 'open,p,{},false,close,p,false,open,h1,{},false,close,h1,false'},
    {html: '<p><h2>', events: 'open,p,{},false,close,p,false,open,h2,{},false,close,h2,false'},
    {html: '<p><h3>', events: 'open,p,{},false,close,p,false,open,h3,{},false,close,h3,false'},
    {html: '<p><h4>', events: 'open,p,{},false,close,p,false,open,h4,{},false,close,h4,false'},
    {html: '<p><h5>', events: 'open,p,{},false,close,p,false,open,h5,{},false,close,h5,false'},
    {html: '<p><h6>', events: 'open,p,{},false,close,p,false,open,h6,{},false,close,h6,false'},
    {html: '<p><header>', events: 'open,p,{},false,close,p,false,open,header,{},false,close,header,false'},
    {html: '<p><hgroup>', events: 'open,p,{},false,close,p,false,open,hgroup,{},false,close,hgroup,false'},
    {html: '<p><hr>', events: 'open,p,{},false,close,p,false,open,hr,{},true,close,hr,true'},
    {html: '<p><main>', events: 'open,p,{},false,close,p,false,open,main,{},false,close,main,false'},
    {html: '<p><nav>', events: 'open,p,{},false,close,p,false,open,nav,{},false,close,nav,false'},
    {html: '<p><ol>', events: 'open,p,{},false,close,p,false,open,ol,{},false,close,ol,false'},
    {html: '<p><p>', events: 'open,p,{},false,close,p,false,open,p,{},false,close,p,false'},
    {html: '<p><pre>', events: 'open,p,{},false,close,p,false,open,pre,{},false,close,pre,false'},
    {html: '<p><section>', events: 'open,p,{},false,close,p,false,open,section,{},false,close,section,false'},
    {html: '<p><table>', events: 'open,p,{},false,close,p,false,open,table,{},false,close,table,false'},
    {html: '<p><ul>', events: 'open,p,{},false,close,p,false,open,ul,{},false,close,ul,false'},
    {html: '<p><ul>', events: 'open,p,{},false,close,p,false,open,ul,{},false,close,ul,false'},

    //An rb element's end tag may be omitted if the rb element is immediately followed by an rb, rt, rtc or rp element, or if there is no more content in the parent element.
    {html: '<rb></rb>a', events: 'open,rb,{},false,close,rb,false,text,a'},
    {html: '<rb></rb><rb></rb>a', events: 'open,rb,{},false,close,rb,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rb></rb><rt></rt>a', events: 'open,rb,{},false,close,rb,false,open,rt,{},false,close,rt,false,text,a'},
    {html: '<rb></rb><rtc></rtc>a', events: 'open,rb,{},false,close,rb,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rb></rb><rp></rp>a', events: 'open,rb,{},false,close,rb,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rb></rb></x>a', events: 'open,x,{},false,open,rb,{},false,close,rb,false,close,x,false,text,a'},
    {html: '<x><rb><foo></x>a', events: 'open,x,{},false,open,rb,{},false,open,foo,{},false,text,a,close,foo,false,close,rb,false,close,x,false'},
    // ----------------------
    {html: '<rb><rb></rb>a', events: 'open,rb,{},false,close,rb,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rb><rt></rt>a', events: 'open,rb,{},false,close,rb,false,open,rt,{},false,close,rt,false,text,a'},
    {html: '<rb><rtc></rtc>a', events: 'open,rb,{},false,close,rb,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rb><rp></rp>a', events: 'open,rb,{},false,close,rb,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rb></x>a', events: 'open,x,{},false,open,rb,{},false,close,rb,false,close,x,false,text,a'},

    //An rt element's end tag may be omitted if the rt element is immediately followed by an rb, rt, rtc, or rp element, or if there is no more content in the parent element.
    {html: '<rt></rt>a', events: 'open,rt,{},false,close,rt,false,text,a'},
    {html: '<rt></rt><rb></rb>a', events: 'open,rt,{},false,close,rt,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rt></rt><rt></rt>a', events: 'open,rt,{},false,close,rt,false,open,rt,{},false,close,rt,false,text,a'},
    {html: '<rt></rt><rtc></rtc>a', events: 'open,rt,{},false,close,rt,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rt></rt><rp></rp>a', events: 'open,rt,{},false,close,rt,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rt></rt></x>a', events: 'open,x,{},false,open,rt,{},false,close,rt,false,close,x,false,text,a'},
    {html: '<x><rt><foo></x>a', events: 'open,x,{},false,open,rt,{},false,open,foo,{},false,text,a,close,foo,false,close,rt,false,close,x,false'},
    // ----------------------
    {html: '<rt><rb></rb>a', events: 'open,rt,{},false,close,rt,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rt><rt></rt>a', events: 'open,rt,{},false,close,rt,false,open,rt,{},false,close,rt,false,text,a'},
    {html: '<rt><rtc></rtc>a', events: 'open,rt,{},false,close,rt,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rt><rp></rp>a', events: 'open,rt,{},false,close,rt,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rt></x>a', events: 'open,x,{},false,open,rt,{},false,close,rt,false,close,x,false,text,a'},

    //An rtc element's end tag may be omitted if the rtc element is immediately followed by an rb, rtc or rp element, or if there is no more content in the parent element.
    {html: '<rtc></rtc>a', events: 'open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rtc></rtc><rb></rb>a', events: 'open,rtc,{},false,close,rtc,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rtc></rtc><rtc></rtc>a', events: 'open,rtc,{},false,close,rtc,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rtc></rtc><rp></rp>a', events: 'open,rtc,{},false,close,rtc,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rtc></rtc></x>a', events: 'open,x,{},false,open,rtc,{},false,close,rtc,false,close,x,false,text,a'},
    {html: '<x><rtc><foo></x>a', events: 'open,x,{},false,open,rtc,{},false,open,foo,{},false,text,a,close,foo,false,close,rtc,false,close,x,false'},
    // ----------------------
    {html: '<rtc><rb></rb>a', events: 'open,rtc,{},false,close,rtc,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rtc><rtc></rtc>a', events: 'open,rtc,{},false,close,rtc,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rtc><rp></rp>a', events: 'open,rtc,{},false,close,rtc,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rtc></x>a', events: 'open,x,{},false,open,rtc,{},false,close,rtc,false,close,x,false,text,a'},

    //An rp element's end tag may be omitted if the rp element is immediately followed by an rb, rt, rtc or rp element, or if there is no more content in the parent element.
    {html: '<rp></rp>a', events: 'open,rp,{},false,close,rp,false,text,a'},
    {html: '<rp></rp><rb></rb>a', events: 'open,rp,{},false,close,rp,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rp></rp><rt></rt>a', events: 'open,rp,{},false,close,rp,false,open,rt,{},false,close,rt,false,text,a'},
    {html: '<rp></rp><rtc></rtc>a', events: 'open,rp,{},false,close,rp,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rp></rp><rp></rp>a', events: 'open,rp,{},false,close,rp,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rp></rp></x>a', events: 'open,x,{},false,open,rp,{},false,close,rp,false,close,x,false,text,a'},
    {html: '<x><rp><foo></x>a', events: 'open,x,{},false,open,rp,{},false,open,foo,{},false,text,a,close,foo,false,close,rp,false,close,x,false'},
    // ----------------------
    {html: '<rp><rb></rb>a', events: 'open,rp,{},false,close,rp,false,open,rb,{},false,close,rb,false,text,a'},
    {html: '<rp><rt></rt>a', events: 'open,rp,{},false,close,rp,false,open,rt,{},false,close,rt,false,text,a'},
    {html: '<rp><rtc></rtc>a', events: 'open,rp,{},false,close,rp,false,open,rtc,{},false,close,rtc,false,text,a'},
    {html: '<rp><rp></rp>a', events: 'open,rp,{},false,close,rp,false,open,rp,{},false,close,rp,false,text,a'},
    {html: '<x><rp></x>a', events: 'open,x,{},false,open,rp,{},false,close,rp,false,close,x,false,text,a'},

    //An optgroup element's end tag may be omitted if the optgroup element is immediately followed by another optgroup element, or if there is no more content in the parent element.
    {html: '<optgroup></optgroup><optgroup></optgroup>a', events: 'open,optgroup,{},false,close,optgroup,false,open,optgroup,{},false,close,optgroup,false,text,a'},
    {html: '<x><optgroup></optgroup></x>a', events: 'open,x,{},false,open,optgroup,{},false,close,optgroup,false,close,x,false,text,a'},
    {html: '<optgroup><x></x>a', events: 'open,optgroup,{},false,open,x,{},false,close,x,false,text,a,close,optgroup,false'},
    // ----------------------
    {html: '<optgroup><optgroup></optgroup>a', events: 'open,optgroup,{},false,close,optgroup,false,open,optgroup,{},false,close,optgroup,false,text,a'},
    {html: '<x><optgroup></x>a', events: 'open,x,{},false,open,optgroup,{},false,close,optgroup,false,close,x,false,text,a'},

    //An option element's end tag may be omitted if the option element is immediately followed by another option element, or if it is immediately followed by an optgroup element, or if there is no more content in the parent element.
    {html: '<option></option><option></option>a', events: 'open,option,{},false,close,option,false,open,option,{},false,close,option,false,text,a'},
    {html: '<option></option><optgroup></optgroup>a', events: 'open,option,{},false,close,option,false,open,optgroup,{},false,close,optgroup,false,text,a'},
    {html: '<x><option></option></x>a', events: 'open,x,{},false,open,option,{},false,close,option,false,close,x,false,text,a'},
    {html: '<option><x></x>a', events: 'open,option,{},false,open,x,{},false,close,x,false,text,a,close,option,false'},
    // ----------------------
    {html: '<option><option></option>a', events: 'open,option,{},false,close,option,false,open,option,{},false,close,option,false,text,a'},
    {html: '<option><optgroup></optgroup>a', events: 'open,option,{},false,close,option,false,open,optgroup,{},false,close,optgroup,false,text,a'},
    {html: '<x><option></x>a', events: 'open,x,{},false,open,option,{},false,close,option,false,close,x,false,text,a'},

    //A thead element's end tag may be omitted if the thead element is immediately followed by a tbody or tfoot element.
    {html: '<thead></thead><tbody></tbody>a', events: 'open,thead,{},false,close,thead,false,open,tbody,{},false,close,tbody,false,text,a'},
    {html: '<thead></thead><tfoot></tfoot>a', events: 'open,thead,{},false,close,thead,false,open,tfoot,{},false,close,tfoot,false,text,a'},
    {html: '<thead><a></a>a', events: 'open,thead,{},false,open,a,{},false,close,a,false,text,a,close,thead,false'},
    // ----------------------
    {html: '<thead><tbody></tbody>a', events: 'open,thead,{},false,close,thead,false,open,tbody,{},false,close,tbody,false,text,a'},
    {html: '<thead><tfoot></tfoot>a', events: 'open,thead,{},false,close,thead,false,open,tfoot,{},false,close,tfoot,false,text,a'},

    //A tbody element's end tag may be omitted if the tbody element is immediately followed by a tbody or tfoot element, or if there is no more content in the parent element.
    {html: '<tbody></tbody><tbody></tbody>a', events: 'open,tbody,{},false,close,tbody,false,open,tbody,{},false,close,tbody,false,text,a'},
    {html: '<tbody></tbody><tfoot></tfoot>a', events: 'open,tbody,{},false,close,tbody,false,open,tfoot,{},false,close,tfoot,false,text,a'},
    {html: '<tbody><a></a>a', events: 'open,tbody,{},false,open,a,{},false,close,a,false,text,a,close,tbody,false'},
    {html: '<x><tbody></tbody></x>a', events: 'open,x,{},false,open,tbody,{},false,close,tbody,false,close,x,false,text,a'},
    // ----------------------
    {html: '<tbody><tbody></tbody>a', events: 'open,tbody,{},false,close,tbody,false,open,tbody,{},false,close,tbody,false,text,a'},
    {html: '<tbody><tfoot></tfoot>a', events: 'open,tbody,{},false,close,tbody,false,open,tfoot,{},false,close,tfoot,false,text,a'},
    {html: '<x><tbody></x>a', events: 'open,x,{},false,open,tbody,{},false,close,tbody,false,close,x,false,text,a'},

    //A tfoot element's end tag may be omitted if the tfoot element is immediately followed by a tbody element, or if there is no more content in the parent element.
    {html: '<tfoot></tfoot><tbody></tbody>a', events: 'open,tfoot,{},false,close,tfoot,false,open,tbody,{},false,close,tbody,false,text,a'},
    {html: '<tfoot><a></a>a', events: 'open,tfoot,{},false,open,a,{},false,close,a,false,text,a,close,tfoot,false'},
    {html: '<x><tfoot></tfoot></x>a', events: 'open,x,{},false,open,tfoot,{},false,close,tfoot,false,close,x,false,text,a'},
    // ----------------------
    {html: '<tfoot><tbody></tbody>a', events: 'open,tfoot,{},false,close,tfoot,false,open,tbody,{},false,close,tbody,false,text,a'},
    {html: '<x><tfoot></x>a', events: 'open,x,{},false,open,tfoot,{},false,close,tfoot,false,close,x,false,text,a'},

    //A tr element's end tag may be omitted if the tr element is immediately followed by another tr element, or if there is no more content in the parent element.
    {html: '<tr></tr><tr></tr>a', events: 'open,tr,{},false,close,tr,false,open,tr,{},false,close,tr,false,text,a'},
    {html: '<tr><a></a>a', events: 'open,tr,{},false,open,a,{},false,close,a,false,text,a,close,tr,false'},
    {html: '<x><tr></tr></x>a', events: 'open,x,{},false,open,tr,{},false,close,tr,false,close,x,false,text,a'},
    // ----------------------
    {html: '<tr><tr></tr>a', events: 'open,tr,{},false,close,tr,false,open,tr,{},false,close,tr,false,text,a'},
    {html: '<x><tr></x>a', events: 'open,x,{},false,open,tr,{},false,close,tr,false,close,x,false,text,a'},

    //A td element's end tag may be omitted if the td element is immediately followed by a td or th element, or if there is no more content in the parent element.
    {html: '<td></td><td></td>a', events: 'open,td,{},false,close,td,false,open,td,{},false,close,td,false,text,a'},
    {html: '<td></td><th></th>a', events: 'open,td,{},false,close,td,false,open,th,{},false,close,th,false,text,a'},
    {html: '<td><a></a>a', events: 'open,td,{},false,open,a,{},false,close,a,false,text,a,close,td,false'},
    {html: '<x><td></td></x>a', events: 'open,x,{},false,open,td,{},false,close,td,false,close,x,false,text,a'},
    // ----------------------
    {html: '<td><td></td>a', events: 'open,td,{},false,close,td,false,open,td,{},false,close,td,false,text,a'},
    {html: '<td><th></th>a', events: 'open,td,{},false,close,td,false,open,th,{},false,close,th,false,text,a'},
    {html: '<x><td></x>a', events: 'open,x,{},false,open,td,{},false,close,td,false,close,x,false,text,a'},

    //A th element's end tag may be omitted if the th element is immediately followed by a td or th element, or if there is no more content in the parent element.
    {html: '<th></th><td></td>a', events: 'open,th,{},false,close,th,false,open,td,{},false,close,td,false,text,a'},
    {html: '<th></th><th></th>a', events: 'open,th,{},false,close,th,false,open,th,{},false,close,th,false,text,a'},
    {html: '<th><a></a>a', events: 'open,th,{},false,open,a,{},false,close,a,false,text,a,close,th,false'},
    {html: '<x><th></th></x>a', events: 'open,x,{},false,open,th,{},false,close,th,false,close,x,false,text,a'},
    // ----------------------
    {html: '<th><td></td>a', events: 'open,th,{},false,close,th,false,open,td,{},false,close,td,false,text,a'},
    {html: '<th><th></th>a', events: 'open,th,{},false,close,th,false,open,th,{},false,close,th,false,text,a'},
    {html: '<x><th></x>a', events: 'open,x,{},false,open,th,{},false,close,th,false,close,x,false,text,a'},
    {html: '>', events: 'text,>'},
    {html: '/>', events: 'text,/>'},
  ];

  tests.forEach(item => {
    it('should parse '+JSON.stringify(item.html), () => {
      const events = parserCollector(item.html);
      assert.strictEqual(events, item.events);
    });
  });

  it('should pass through options', () => {
    const parser = new Parser({ entities: entityMap });
    const [tkn] = [...parser.parse('&deg;')].filter(isTextToken);
    assert.strictEqual(tkn.text, '\u00B0');
  });

  it('should be extendable', () => {
    class Parser2 extends Parser { foo() {} }
    const parser = new Parser2();
    const html = '<p>hello</p>';
    const a = [...parser.parse(html)];
    assert.ok(a.length > 0);
  });

  it('should have static', () => {
    const html = '<p>hello</p>';
    const a = [...Parser.parse(html)];
    assert.ok(a.length > 0);
  });

  it('should parse a wikipedia page', () => {
    function attify(atts: Attributes) {
      return Object.entries(atts)
        .map(([k, v]) => ` ${k}="${v}"`)
        .join('');
    }
    const parser = new Parser();
    const content = [];

    for (const tkn of parser.parse(WIKIPEDIA_PAGE)) {
      if (tkn.type === 'open') {
        content.push(tkn.selfClosing
          ? `<${tkn.name}${attify(tkn.attributes)}/>`
          : `<${tkn.name}${attify(tkn.attributes)}>`,
        );
      } else if (tkn.type === 'close' && !tkn.selfClosing) {
        content.push(`</${tkn.name}>`);
      } else if (tkn.type === 'text') {
        content.push(tkn.text);
      } else if (tkn.type === 'comment') {
        content.push(`<!--${tkn.text}-->`);
      }
    }
    const contentString = content.join('');
    const $ = cheerio.load(contentString);
    // console.log(content)
    assert.strictEqual($('.body').length, 5);
    assert.strictEqual($('script').length, 10);
    assert.strictEqual($('#n-mainpage-description').text(), 'Main page');
  });
});

function parserCollector(html: string) {
  const parser = new Parser();
  return [...parser.parse(html)]
    .map((item) => {
      const vals = Object.values(item)
        .map(val => typeof val === 'string'
          ? val
          : JSON.stringify(val),
        );
      return [...vals].join(',');
    })
    .join(',');
}

function isTextToken(tkn: ParseToken): tkn is TextParseToken {
  return tkn.type === 'text';
}

const WIKIPEDIA_PAGE = `<!DOCTYPE html>
<html lang="en" dir="ltr" class="client-nojs">
<head>
<meta charset="UTF-8" />
<title>Non-breaking space - Wikipedia, the free encyclopedia</title>
<meta name="generator" content="MediaWiki 1.26wmf7" />
<link rel="alternate" href="android-app://org.wikipedia/http/en.m.wikipedia.org/wiki/Non-breaking_space" />
<link rel="alternate" type="application/x-wiki" title="Edit this page" href="/w/index.php?title=Non-breaking_space&amp;action=edit" />
<link rel="edit" title="Edit this page" href="/w/index.php?title=Non-breaking_space&amp;action=edit" />
<link rel="apple-touch-icon" href="/static/apple-touch/wikipedia.png" />
<link rel="shortcut icon" href="/static/favicon/wikipedia.ico" />
<link rel="search" type="application/opensearchdescription+xml" href="/w/opensearch_desc.php" title="Wikipedia (en)" />
<link rel="EditURI" type="application/rsd+xml" href="//en.wikipedia.org/w/api.php?action=rsd" />
<link rel="alternate" hreflang="x-default" href="/wiki/Non-breaking_space" />
<link rel="copyright" href="//creativecommons.org/licenses/by-sa/3.0/" />
<link rel="alternate" type="application/atom+xml" title="Wikipedia Atom feed" href="/w/index.php?title=Special:RecentChanges&amp;feed=atom" />
<link rel="canonical" href="http://en.wikipedia.org/wiki/Non-breaking_space" />
<link rel="stylesheet" href="//en.wikipedia.org/w/load.php?debug=false&amp;lang=en&amp;modules=ext.gadget.DRN-wizard%2CReferenceTooltips%2Ccharinsert%2Cfeatured-articles-links%2CrefToolbar%2Cswitcher%2Cteahouse%7Cext.geshi.language.text%7Cext.geshi.local%7Cext.rtlcite%2Cwikihiero%2CwikimediaBadges%7Cext.uls.nojs%7Cext.visualEditor.viewPageTarget.noscript%7Cmediawiki.legacy.commonPrint%2Cshared%7Cmediawiki.sectionAnchor%7Cmediawiki.skinning.interface%7Cmediawiki.ui.button%7Cskins.vector.styles%7Cwikibase.client.init&amp;only=styles&amp;skin=vector&amp;*" />
<meta name="ResourceLoaderDynamicStyles" content="" />
<link rel="stylesheet" href="//en.wikipedia.org/w/load.php?debug=false&amp;lang=en&amp;modules=site&amp;only=styles&amp;skin=vector&amp;*" />
<style>a:lang(ar),a:lang(kk-arab),a:lang(mzn),a:lang(ps),a:lang(ur){text-decoration:none}
/* cache key: enwiki:resourceloader:filter:minify-css:7:3904d24a08aa08f6a68dc338f9be277e */</style>
<script src="//en.wikipedia.org/w/load.php?debug=false&amp;lang=en&amp;modules=startup&amp;only=scripts&amp;skin=vector&amp;*"></script>
<script>if(window.mw){
mw.config.set({"wgCanonicalNamespace":"","wgCanonicalSpecialPageName":false,"wgNamespaceNumber":0,"wgPageName":"Non-breaking_space","wgTitle":"Non-breaking space","wgCurRevisionId":665330371,"wgRevisionId":665330371,"wgArticleId":933901,"wgIsArticle":true,"wgIsRedirect":false,"wgAction":"view","wgUserName":null,"wgUserGroups":["*"],"wgCategories":["Control characters","Whitespace","Unicode formatting code points","CS1 maint: English language specified","CS1 Finnish-language sources (fi)"],"wgBreakFrames":false,"wgPageContentLanguage":"en","wgPageContentModel":"wikitext","wgSeparatorTransformTable":["",""],"wgDigitTransformTable":["",""],"wgDefaultDateFormat":"dmy","wgMonthNames":["","January","February","March","April","May","June","July","August","September","October","November","December"],"wgMonthNamesShort":["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],"wgRelevantPageName":"Non-breaking_space","wgRelevantArticleId":933901,"wgIsProbablyEditable":true,"wgRestrictionEdit":[],"wgRestrictionMove":[],"wgWikiEditorEnabledModules":{"toolbar":true,"dialogs":true,"hidesig":true,"preview":false,"publish":false},"wgMediaViewerOnClick":true,"wgMediaViewerEnabledByDefault":true,"wgVisualEditor":{"pageLanguageCode":"en","pageLanguageDir":"ltr","usePageImages":true,"usePageDescriptions":true},"wikilove-recipient":"","wikilove-anon":0,"wgPoweredByHHVM":true,"wgULSAcceptLanguageList":["en-gb"],"wgULSCurrentAutonym":"English","wgBetaFeaturesFeatures":[],"wgGatherShouldShowTutorial":true,"wgFlaggedRevsParams":{"tags":{"status":{"levels":1,"quality":2,"pristine":3}}},"wgStableRevisionId":null,"wgCategoryTreePageCategoryOptions":"{"mode":0,"hideprefix":20,"showcount":true,"namespaces":false}","wgNoticeProject":"wikipedia","wgWikibaseItemId":"Q1053612"});
}</script><script>if(window.mw){
mw.loader.implement("user.options",function($,jQuery){mw.user.options.set({"variant":"en"});});
/* cache key: enwiki:resourceloader:filter:minify-js:7:b2706269305541eba923c165462b22c4 */
}</script>
<script>if(window.mw){
mw.loader.implement("user.tokens",function($,jQuery){mw.user.tokens.set({"editToken":"+\\","patrolToken":"+\\","watchToken":"+\\"});});
}</script>
<script>if(window.mw){
mw.loader.load(["mediawiki.page.startup","mediawiki.legacy.wikibits","mediawiki.legacy.ajax","ext.centralauth.centralautologin","ext.imageMetrics.head","ext.visualEditor.viewPageTarget.init","ext.uls.init","ext.uls.interface","ext.centralNotice.bannerController","skins.vector.js"]);
}</script>
<link rel="dns-prefetch" href="//meta.wikimedia.org" />
<!--[if lt IE 7]><style type="text/css">body{behavior:url("/w/static/1.26wmf7/skins/Vector/csshover.min.htc")}</style><![endif]-->
</head>
<body class="mediawiki ltr sitedir-ltr ns-0 ns-subject page-Non-breaking_space skin-vector action-view">
    <div id="mw-page-base" class="noprint"></div>
    <div id="mw-head-base" class="noprint"></div>
    <div id="content" class="mw-body" role="main">
      <a id="top"></a>

              <div id="siteNotice"><!-- CentralNotice --></div>
            <div class="mw-indicators">
</div>
      <h1 id="firstHeading" class="firstHeading" lang="en">Non-breaking space</h1>
                  <div id="bodyContent" class="mw-body-content">
                  <div id="siteSub">From Wikipedia, the free encyclopedia</div>
                <div id="contentSub"></div>
                        <div id="jump-to-nav" class="mw-jump">
          Jump to:          <a href="#mw-head">navigation</a>,          <a href="#p-search">search</a>
        </div>
        <div id="mw-content-text" lang="en" dir="ltr" class="mw-content-ltr"><p>In <a href="/wiki/Word_processing" title="Word processing" class="mw-redirect">word processing</a> and <a href="/wiki/Digital_typesetting" title="Digital typesetting" class="mw-redirect">digital typesetting</a>, a <b>non-breaking space</b> ("&#160;"), also known as a <b>no-break space</b> or <b>non-breakable space</b> (<b>NBSP</b>), is a variant of the <a href="/wiki/Space_character" title="Space character" class="mw-redirect">space character</a> that prevents an automatic line break (<a href="/wiki/Line_wrap" title="Line wrap" class="mw-redirect">line wrap</a>) at its position.</p>
<p>In certain formats (such as <a href="/wiki/HTML" title="HTML">HTML</a>), it also prevents the “collapsing” of multiple consecutive <a href="/wiki/Whitespace_(computer_science)" title="Whitespace (computer science)" class="mw-redirect">whitespace characters</a> into a single space. The non-breaking space is also known as a <b><a href="/wiki/Hard_space" title="Hard space">hard space</a></b> or <b>fixed space</b>. In <a href="/wiki/Unicode" title="Unicode">Unicode</a>, the "common" non-breaking space is encoded as <span class="nowrap">U+00A0</span> <span class="unicode" style="background:lightblue">&#160;</span> <span class="smallcaps" style="font-variant:small-caps;">no-break space</span> (HTML&#160;<code>&amp;#160;</code>&#160;<b>·</b>  <code>&amp;nbsp;</code>). Other <a href="#Width_variation">width variations</a> also exist.</p>
<p></p>
<div id="toc" class="toc">
<div id="toctitle">
<h2>Contents</h2>
</div>
<ul>
<li class="toclevel-1 tocsection-1"><a href="#Uses_and_variations"><span class="tocnumber">1</span> <span class="toctext">Uses and variations</span></a>
<ul>
<li class="toclevel-2 tocsection-2"><a href="#Non-breaking_behavior"><span class="tocnumber">1.1</span> <span class="toctext">Non-breaking behavior</span></a></li>
<li class="toclevel-2 tocsection-3"><a href="#Non-collapsing_behavior"><span class="tocnumber">1.2</span> <span class="toctext">Non-collapsing behavior</span></a></li>
<li class="toclevel-2 tocsection-4"><a href="#Width_variation"><span class="tocnumber">1.3</span> <span class="toctext">Width variation</span></a></li>
</ul>
</li>
<li class="toclevel-1 tocsection-5"><a href="#Encodings"><span class="tocnumber">2</span> <span class="toctext">Encodings</span></a></li>
<li class="toclevel-1 tocsection-6"><a href="#Keyboard_entry_methods"><span class="tocnumber">3</span> <span class="toctext">Keyboard entry methods</span></a></li>
<li class="toclevel-1 tocsection-7"><a href="#See_also"><span class="tocnumber">4</span> <span class="toctext">See also</span></a></li>
<li class="toclevel-1 tocsection-8"><a href="#References"><span class="tocnumber">5</span> <span class="toctext">References</span></a></li>
</ul>
</div>
<p></p>
<h2><span class="mw-headline" id="Uses_and_variations">Uses and variations</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=1" title="Edit section: Uses and variations">edit</a><span class="mw-editsection-bracket">]</span></span></h2>
<p>Despite having similar layout and uses with <a href="/wiki/Whitespace_(computer_science)" title="Whitespace (computer science)" class="mw-redirect">whitespace</a>, it differs in contextual behavior.<sup id="cite_ref-1" class="reference"><a href="#cite_note-1"><span>[</span>1<span>]</span></a></sup><sup id="cite_ref-2" class="reference"><a href="#cite_note-2"><span>[</span>2<span>]</span></a></sup></p>
<h3><span class="mw-headline" id="Non-breaking_behavior">Non-breaking behavior</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=2" title="Edit section: Non-breaking behavior">edit</a><span class="mw-editsection-bracket">]</span></span></h3>
<p>Text-processing software typically assumes that an automatic line break may be inserted anywhere a space character occurs; a non-breaking space prevents this from happening (provided the software recognizes the character). For example, if the text "100 km" (according to the <a href="/wiki/Style_guide" title="Style guide">style guide</a>) will not quite fit at the end of a line, the software may insert a line break between "100" and "km". To avoid this undesirable behaviour, the editor may choose to use a non-breaking space between "100" and "km". This guarantees that the text "100&#160;km" will not be broken: if it does not fit at the end of a line it is moved in its entirety to the next line.</p>
<h3><span class="mw-headline" id="Non-collapsing_behavior">Non-collapsing behavior</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=3" title="Edit section: Non-collapsing behavior">edit</a><span class="mw-editsection-bracket">]</span></span></h3>
<p>A second common application of non-breaking spaces is in <a href="/wiki/Plain_text" title="Plain text">plain text</a> file formats such as <a href="/wiki/SGML" title="SGML" class="mw-redirect">SGML</a>, <a href="/wiki/HTML" title="HTML">HTML</a>, <a href="/wiki/TeX" title="TeX">TeX</a> and <a href="/wiki/LaTeX" title="LaTeX">LaTeX</a>, which treat sequences of <a href="/wiki/Whitespace_(computer_science)" title="Whitespace (computer science)" class="mw-redirect">whitespace characters</a> (space, newline, tab, <a href="/wiki/Form_feed" title="Form feed" class="mw-redirect">form feed</a>, etc.) as if they were a single character. Such "collapsing" of whitespace allows the author to neatly arrange the source text using line breaks, indentation and other forms of spacing without affecting the final typeset result.<sup id="cite_ref-3" class="reference"><a href="#cite_note-3"><span>[</span>3<span>]</span></a></sup><sup id="cite_ref-4" class="reference"><a href="#cite_note-4"><span>[</span>4<span>]</span></a></sup></p>
<p>In contrast, non-breaking spaces are not merged with neighboring whitespace characters when displayed, and can therefore be used by an author to insert additional visible space in the resulting output. Conversely, indiscriminate use (see the recommended use in <a href="/wiki/Style_guide" title="Style guide">style guides</a>), in addition to a normal space, gives extraneous extra space in the output.</p>
<h3><span class="mw-headline" id="Width_variation">Width variation</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=4" title="Edit section: Width variation">edit</a><span class="mw-editsection-bracket">]</span></span></h3>
<p>Other non-breaking variants, <a href="/wiki/Space_(punctuation)#Spaces_in_Unicode" title="Space (punctuation)">defined in Unicode</a>:</p>
<ul>
<li><span class="nowrap">U+2007</span> <span class="unicode" style="background:lightblue"> </span> <a href="/wiki/Figure_space" title="Figure space"><span class="smallcaps" style="font-variant:small-caps;">figure space</span></a> (HTML&#160;<code>&amp;#8199;</code>). Produces a space somewhat equal to the figures (0–9) characters.</li>
<li><span class="nowrap">U+202F</span> <span class="unicode" style="background:lightblue"> </span> <span class="smallcaps" style="font-variant:small-caps;">narrow no-break space</span> (HTML&#160;<code>&amp;#8239;</code>&#160;<b>·</b>  <code>NNBSP</code>). It was introduced in Unicode 3.0 for Mongolian,<sup id="cite_ref-5" class="reference"><a href="#cite_note-5"><span>[</span>5<span>]</span></a></sup> to separate a suffix from the word stem without indicating a word boundary. It is also required for <a href="/wiki/Punctuation" title="Punctuation">punctuation</a> in French (before "<span style="white-space: nowrap;"><span class="Unicode"> </span>:<span class="Unicode"> </span>;<span class="Unicode"> </span>?<span class="Unicode"> </span>!<span class="Unicode"> </span>»</span><span class="Unicode"> </span>" and after "<span class="Unicode"> </span>«<span class="Unicode"> </span>") and Russian (before "<span class="Unicode"> </span>—<span class="Unicode"> </span>"). When used with Mongolian, its width is usually one third of the normal space; in other contexts, its width resembles that of the <a href="/wiki/Thin_space" title="Thin space">thin space</a> (U+2009), at least with some fonts.<sup id="cite_ref-6" class="reference"><a href="#cite_note-6"><span>[</span>6<span>]</span></a></sup></li>
<li><span class="nowrap">U+2060</span>  <a href="/wiki/Word-joiner" title="Word-joiner" class="mw-redirect"><span class="smallcaps" style="font-variant:small-caps;">word-joiner</span></a> (HTML&#160;<code>&amp;#8288;</code>&#160;<b>·</b>  <code>WJ</code>): encoded in Unicode since version 3.2. The word-joiner does not produce any space, and prohibits a line break at its position.</li>
</ul>
<h2><span class="mw-headline" id="Encodings">Encodings</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=5" title="Edit section: Encodings">edit</a><span class="mw-editsection-bracket">]</span></span></h2>
<table class="wikitable">
<tr>
<th>Format</th>
<th>Representation of non-breaking space</th>
</tr>
<tr>
<td><a href="/wiki/Unicode" title="Unicode">Unicode</a> and <a href="/wiki/ISO/IEC_10646" title="ISO/IEC 10646" class="mw-redirect">ISO/IEC 10646</a></td>
<td><span class="nowrap">U+00A0</span> <span class="unicode" style="background:lightblue">&#160;</span> <span class="smallcaps" style="font-variant:small-caps;">no-break space</span> (HTML&#160;<code>&amp;#160;</code>&#160;<b>·</b>  <code>&amp;nbsp;</code>)<br />
Can be encoded in <a href="/wiki/UTF-8" title="UTF-8">UTF-8</a> as <code><span class="mw-geshi text source-text">C2</span></code><span style="white-space:nowrap;">&#160;</span><code><span class="mw-geshi text source-text">A0</span></code></td>
</tr>
<tr>
<td><a href="/wiki/ISO/IEC_8859" title="ISO/IEC 8859">ISO/IEC 8859</a></td>
<td><code><span class="mw-geshi text source-text">A0</span></code></td>
</tr>
<tr>
<td><a href="/wiki/CP1252" title="CP1252" class="mw-redirect">CP1252</a> (MS Windows default in most countries using <a href="/wiki/Germanic_languages" title="Germanic languages">Germanic</a> or <a href="/wiki/Romance_languages" title="Romance languages">Romance languages</a>)</td>
<td><code><span class="mw-geshi text source-text">A0</span></code></td>
</tr>
<tr>
<td><a href="/wiki/KOI8-R" title="KOI8-R">KOI8-R</a></td>
<td><code><span class="mw-geshi text source-text">9A</span></code></td>
</tr>
<tr>
<td><a href="/wiki/EBCDIC" title="EBCDIC">EBCDIC</a></td>
<td><code><span class="mw-geshi text source-text">41</span></code> – RSP, Required Space</td>
</tr>
<tr>
<td><a href="/wiki/Code_page_437" title="Code page 437">CP437</a>, <a href="/wiki/Code_page_850" title="Code page 850">CP850</a>, <a href="/wiki/Code_page_866" title="Code page 866">CP866</a></td>
<td><code><span class="mw-geshi text source-text">FF</span></code></td>
</tr>
<tr>
<td><a href="/wiki/HTML" title="HTML">HTML</a> (including <a href="/wiki/Wikitext" title="Wikitext" class="mw-redirect">Wikitext</a>)</td>
<td><a href="/wiki/List_of_XML_and_HTML_character_entity_references" title="List of XML and HTML character entity references">Character entity reference</a>: <code><span class="mw-geshi text source-text">&amp;nbsp;</span></code><br />
<a href="/wiki/Numeric_character_reference" title="Numeric character reference">Numeric character references</a>: <code><span class="mw-geshi text source-text">&amp;#160;</span></code> or <code><span class="mw-geshi text source-text">&amp;#xA0;</span></code></td>
</tr>
<tr>
<td><a href="/wiki/TeX" title="TeX">TeX</a></td>
<td><a href="/wiki/Tilde" title="Tilde">tilde</a> (<code><span class="mw-geshi text source-text">~</span></code>)</td>
</tr>
<tr>
<td><a href="/wiki/ASCII" title="ASCII">ASCII</a></td>
<td><i>Not available</i></td>
</tr>
</table>
<p>Unicode defines several other non-break space characters. See <a href="#Width_variation">#Width variation</a>. Encoding remarks:</p>
<ul>
<li>Word joiner, encoded in Unicode 3.2 and above as U+2060, and in HTML as <code><span class="mw-geshi text source-text">&amp;#x2060;</span></code> or <code><span class="mw-geshi text source-text">&amp;#8288;</span></code>.</li>
<li>The <a href="/wiki/Byte_Order_Mark" title="Byte Order Mark" class="mw-redirect">Byte Order Mark</a>, U+FEFF, officially named "Zero Width No-Break Space", can also be used with the same meaning as the word joiner, but in current documents this use is deprecated. See also <a href="/wiki/Zero-width_non-breaking_space" title="Zero-width non-breaking space" class="mw-redirect">Zero-width non-breaking space</a>.</li>
</ul>
<h2><span class="mw-headline" id="Keyboard_entry_methods">Keyboard entry methods</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=6" title="Edit section: Keyboard entry methods">edit</a><span class="mw-editsection-bracket">]</span></span></h2>
<p>It is rare for national or international standards on <a href="/wiki/Keyboard_layout" title="Keyboard layout">keyboard layouts</a> to define an input method for the non-breaking space. An exception is the Finnish multilingual keyboard, accepted as the national standard SFS 5966 in 2008. According to the SFS setting, the non-breaking space can be entered with the key combination <a href="/wiki/AltGr" title="AltGr" class="mw-redirect">AltGr</a> + <a href="/wiki/Space_bar" title="Space bar">Space</a>.<sup id="cite_ref-7" class="reference"><a href="#cite_note-7"><span>[</span>7<span>]</span></a></sup></p>
<p>Typically, authors of keyboard drivers and application programs (e.g., <a href="/wiki/Word_processor" title="Word processor">word processors</a>) have devised their own <a href="/wiki/Keyboard_shortcut" title="Keyboard shortcut">keyboard shortcuts</a> for the non-breaking space. For example:</p>
<table class="wikitable">
<tr>
<th>System/application</th>
<th>Entry method</th>
</tr>
<tr>
<td><a href="/wiki/Microsoft_Windows" title="Microsoft Windows">Microsoft Windows</a></td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><a href="/wiki/Alt_key#Windows" title="Alt key">Alt</a></kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">0</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">1</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">6</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">0</kbd> or <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><a href="/wiki/Alt_key#Windows" title="Alt key">Alt</a></kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">2</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">5</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">5</kbd> (doesn't always work)</td>
</tr>
<tr>
<td><a href="/wiki/Apple_Computer" title="Apple Computer" class="mw-redirect">Apple</a> <a href="/wiki/Mac_OS_X" title="Mac OS X" class="mw-redirect">Mac OS X</a></td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><span class="Unicode">⌥</span> <a href="/wiki/Option_key" title="Option key">Opt</a></kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><a href="/wiki/Space_bar" title="Space bar">Space</a></kbd></td>
</tr>
<tr>
<td><a href="/wiki/Linux" title="Linux">Linux</a> or <a href="/wiki/Unix" title="Unix">Unix</a> using <a href="/wiki/X11" title="X11" class="mw-redirect">X11</a></td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><a href="/wiki/Compose_key" title="Compose key">Compose</a></kbd>, <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Space</kbd>, <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Space</kbd></td>
</tr>
<tr>
<td><a href="/wiki/GNU_Project" title="GNU Project">GNU</a> <a href="/wiki/Emacs" title="Emacs">Emacs</a></td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><a href="/wiki/Control_key" title="Control key">Ctrl</a></kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">X</kbd> <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">8</kbd> <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Space</kbd></td>
</tr>
<tr>
<td><a href="/wiki/Vim_(text_editor)" title="Vim (text editor)">Vim</a></td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Ctrl</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">K</kbd>, <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Space</kbd>, <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Space</kbd>; or <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Ctrl</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">K</kbd>, <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><span class="Unicode">⇧</span> <a href="/wiki/Shift_key" title="Shift key">Shift</a></kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">N</kbd>, <kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><span class="Unicode">⇧</span> Shift</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">S</kbd></td>
</tr>
<tr>
<td><a href="/wiki/Dreamweaver" title="Dreamweaver" class="mw-redirect">Dreamweaver</a>, <a href="/wiki/LibreOffice" title="LibreOffice">LibreOffice</a>, <a href="/wiki/Microsoft_Word" title="Microsoft Word">Microsoft Word</a>,<br />
<a href="/wiki/OpenOffice.org" title="OpenOffice.org">OpenOffice.org</a> (since 3.0)</td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Ctrl</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><span class="Unicode">⇧</span> Shift</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Space</kbd></td>
</tr>
<tr>
<td><a href="/wiki/Adobe_FrameMaker" title="Adobe FrameMaker">FrameMaker</a>, <a href="/wiki/LyX" title="LyX">LyX</a>, <a href="/wiki/OpenOffice.org" title="OpenOffice.org">OpenOffice.org</a> (before 3.0),<br />
<a href="/wiki/WordPerfect" title="WordPerfect">WordPerfect</a></td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Ctrl</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">Space</kbd></td>
</tr>
<tr>
<td>Mac <a href="/wiki/Adobe_InDesign" title="Adobe InDesign">Adobe InDesign</a></td>
<td><kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><span class="Unicode">⌥</span> Opt</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;"><span class="Unicode">⌘</span> Cmd</kbd>+<kbd class="keyboard-key nowrap" style="border: 1px solid #aaa; -moz-border-radius: 0.2em; -webkit-border-radius: 0.2em; border-radius: 0.2em; -moz-box-shadow: 0.1em 0.2em 0.2em #ddd; -webkit-box-shadow: 0.1em 0.2em 0.2em #ddd; box-shadow: 0.1em 0.2em 0.2em #ddd; background-color: #f9f9f9; background-image: -moz-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -o-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: -webkit-linear-gradient(top, #eee, #f9f9f9, #eee); background-image: linear-gradient(to bottom, #eee, #f9f9f9, #eee); padding: 0.1em 0.3em; font-family: inherit; font-size: 0.85em;">X</kbd></td>
</tr>
</table>
<p>Apart from this, applications and environments often have methods of entering unicode entities directly via their code point, e.g. via the <a href="/wiki/Alt_Numpad" title="Alt Numpad" class="mw-redirect">Alt Numpad</a> input method. (Non-breaking space has codepoint <tt>255</tt> decimal (<tt>FF</tt> hex) in <a href="/wiki/Codepage_437" title="Codepage 437" class="mw-redirect">codepage 437</a> and <a href="/wiki/Codepage_850" title="Codepage 850" class="mw-redirect">codepage 850</a>, and codepoint <tt>160</tt> decimal (<tt>A0</tt> hex) in <a href="/wiki/Codepage_1252" title="Codepage 1252" class="mw-redirect">codepage 1252</a>.)</p>
<h2><span class="mw-headline" id="See_also">See also</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=7" title="Edit section: See also">edit</a><span class="mw-editsection-bracket">]</span></span></h2>
<ul>
<li><a href="/wiki/Hyphen#In_computing" title="Hyphen">Hyphens in computing</a>, for information about hard and non-breaking hyphens</li>
<li><a href="/wiki/List_of_XML_and_HTML_character_entity_references" title="List of XML and HTML character entity references">List of XML and HTML character entity references</a></li>
<li><a href="/wiki/Orphans_and_widows" title="Orphans and widows" class="mw-redirect">Orphans and widows</a></li>
<li><a href="/wiki/Punctuation" title="Punctuation">Punctuation</a></li>
<li><a href="/wiki/Sentence_spacing_in_digital_media" title="Sentence spacing in digital media">Sentence spacing in digital media</a></li>
<li><a href="/wiki/Space_(punctuation)" title="Space (punctuation)">Space (punctuation)</a>
<ul>
<li><a href="/wiki/Zero-width_space" title="Zero-width space">Zero-width space</a>, a non-spacing break</li>
</ul>
</li>
</ul>
<h2><span class="mw-headline" id="References">References</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit&amp;section=8" title="Edit section: References">edit</a><span class="mw-editsection-bracket">]</span></span></h2>
<ol class="references">
<li id="cite_note-1"><span class="mw-cite-backlink"><b><a href="#cite_ref-1">^</a></b></span> <span class="reference-text">"Justify Just or Just Justify", M. Elyaakoubi and A. Lazrek. Journal of Electronic Publishing, vol. 13, issue 1, 2010. <a rel="nofollow" class="external text" href="http://dx.doi.org/10.3998/3336451.0013.105">DOI 10.3998/3336451.0013.105</a>.</span></li>
<li id="cite_note-2"><span class="mw-cite-backlink"><b><a href="#cite_ref-2">^</a></b></span> <span class="reference-text"><a rel="nofollow" class="external free" href="http://www.chicagomanualofstyle.org/qanda/data/faq/topics/SpecialCharacters.html">http://www.chicagomanualofstyle.org/qanda/data/faq/topics/SpecialCharacters.html</a></span></li>
<li id="cite_note-3"><span class="mw-cite-backlink"><b><a href="#cite_ref-3">^</a></b></span> <span class="reference-text"><span id="CITEREF1999" class="citation">"Structure", <a rel="nofollow" class="external text" href="http://www.w3.org/TR/1999/REC-html401-19991224/struct/text.html#h-9.1"><i>HTML 4.01</i></a>, W3, 1999-12-24</span><span title="ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3ANon-breaking+space&amp;rft.atitle=Structure&amp;rft.btitle=HTML+4.01&amp;rft.date=1999-12-24&amp;rft.genre=bookitem&amp;rft_id=http%3A%2F%2Fwww.w3.org%2FTR%2F1999%2FREC-html401-19991224%2Fstruct%2Ftext.html%23h-9.1&amp;rft.pub=W3&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook" class="Z3988"><span style="display:none;">&#160;</span></span>.</span></li>
<li id="cite_note-4"><span class="mw-cite-backlink"><b><a href="#cite_ref-4">^</a></b></span> <span class="reference-text"><span class="citation">"Text", <a rel="nofollow" class="external text" href="http://www.w3.org/TR/CSS21/text.html#white-space-prop"><i>CSS 2.1</i></a>, W3</span><span title="ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3ANon-breaking+space&amp;rft.atitle=Text&amp;rft.btitle=CSS+2.1&amp;rft.genre=bookitem&amp;rft_id=http%3A%2F%2Fwww.w3.org%2FTR%2FCSS21%2Ftext.html%23white-space-prop&amp;rft.pub=W3&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook" class="Z3988"><span style="display:none;">&#160;</span></span>.</span></li>
<li id="cite_note-5"><span class="mw-cite-backlink"><b><a href="#cite_ref-5">^</a></b></span> <span class="reference-text">ISO/IEC 10646-1:1993/FDAM 29:1999(E)</span></li>
<li id="cite_note-6"><span class="mw-cite-backlink"><b><a href="#cite_ref-6">^</a></b></span> <span class="reference-text"><span class="citation web"><a rel="nofollow" class="external text" href="http://www.unicode.org/versions/Unicode7.0.0/ch06.pdf">"Writing Systems and Punctuation"</a> <span style="font-size:85%;">(PDF)</span>. <i>The Unicode Standard 7.0</i>. <a href="/wiki/Unicode_Consortium" title="Unicode Consortium">Unicode Inc.</a> 2014<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-11-02</span></span>.</span><span title="ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3ANon-breaking+space&amp;rft.atitle=Writing+Systems+and+Punctuation&amp;rft.date=2014&amp;rft.genre=article&amp;rft_id=http%3A%2F%2Fwww.unicode.org%2Fversions%2FUnicode7.0.0%2Fch06.pdf&amp;rft.jtitle=The+Unicode+Standard+7.0&amp;rft.pub=Unicode+Inc.&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal" class="Z3988"><span style="display:none;">&#160;</span></span></span></li>
<li id="cite_note-7"><span class="mw-cite-backlink"><b><a href="#cite_ref-7">^</a></b></span> <span class="reference-text"><span id="CITEREFKotoistus2006" class="citation">Kotoistus (2006-12-28), <a rel="nofollow" class="external text" href="http://www.csc.fi/sivut/kotoistus/nappaimisto.htm"><i>Uusi näppäinasettelu</i> [<i>Status of the new keyboard layout</i>]</a> (presentation) (in Finnish and English), <a href="/wiki/CSC_%E2%80%93_IT_Center_for_Science_Ltd." title="CSC – IT Center for Science Ltd." class="mw-redirect">CSC – IT Center for Science</a></span><span title="ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3ANon-breaking+space&amp;rft.au=Kotoistus&amp;rft.aulast=Kotoistus&amp;rft.btitle=Uusi+n%C3%A4pp%C3%A4inasettelu&amp;rft.date=2006-12-28&amp;rft.genre=book&amp;rft_id=http%3A%2F%2Fwww.csc.fi%2Fsivut%2Fkotoistus%2Fnappaimisto.htm&amp;rft.place=CSC+%E2%80%93+IT+Center+for+Science&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook" class="Z3988"><span style="display:none;">&#160;</span></span> <span class="citation-comment" style="display:none; color:#33aa33">CS1 maint: English language specified (<a href="/wiki/Category:CS1_maint:_English_language_specified" title="Category:CS1 maint: English language specified">link</a>)</span>. Drafts of the Finnish multilingual keyboard.</span></li>
</ol>


<!-- 
NewPP limit report
Parsed by mw1108
CPU time usage: 0.354 seconds
Real time usage: 0.404 seconds
Preprocessor visited node count: 8939/1000000
Preprocessor generated node count: 0/1500000
Post‐expand include size: 93424/2097152 bytes
Template argument size: 8966/2097152 bytes
Highest expansion depth: 20/40
Expensive parser function count: 0/500
Lua time usage: 0.050/10.000 seconds
Lua memory usage: 1.84 MB/50 MB
-->

<!-- 
Transclusion expansion time report (%,ms,calls,template)
100.00%  371.294      1 - -total
 31.89%  118.408      5 - Template:Unichar
 30.61%  113.659      5 - Template:Unichar/main
 29.10%  108.040     18 - Template:Key_press
 24.22%   89.917     36 - Template:Key_press/core
 13.27%   49.258      3 - Template:Citation
 11.17%   41.492     10 - Template:Hex2dec
  8.46%   31.413      5 - Template:Unichar/notes
  7.04%   26.156      5 - Template:Unichar/glyph
  6.14%   22.804      5 - Template:Numcr2namecr
-->

<!-- Saved in parser cache with key enwiki:pcache:idhash:933901-0!*!0!!en!*!* and timestamp 20150603142825 and revision id 665330371
 -->
<noscript><img src="//en.wikipedia.org/wiki/Special:CentralAutoLogin/start?type=1x1" alt="" title="" width="1" height="1" style="border: none; position: absolute;" /></noscript></div>                 <div class="printfooter">
            Retrieved from "<a dir="ltr" href="http://en.wikipedia.org/w/index.php?title=Non-breaking_space&amp;oldid=665330371">http://en.wikipedia.org/w/index.php?title=Non-breaking_space&amp;oldid=665330371</a>"          </div>
                          <div id='catlinks' class='catlinks'><div id="mw-normal-catlinks" class="mw-normal-catlinks"><a href="/wiki/Help:Category" title="Help:Category">Categories</a>: <ul><li><a href="/wiki/Category:Control_characters" title="Category:Control characters">Control characters</a></li><li><a href="/wiki/Category:Whitespace" title="Category:Whitespace">Whitespace</a></li><li><a href="/wiki/Category:Unicode_formatting_code_points" title="Category:Unicode formatting code points">Unicode formatting code points</a></li></ul></div><div id="mw-hidden-catlinks" class="mw-hidden-catlinks mw-hidden-cats-hidden">Hidden categories: <ul><li><a href="/wiki/Category:CS1_maint:_English_language_specified" title="Category:CS1 maint: English language specified">CS1 maint: English language specified</a></li><li><a href="/wiki/Category:CS1_Finnish-language_sources_(fi)" title="Category:CS1 Finnish-language sources (fi)">CS1 Finnish-language sources (fi)</a></li></ul></div></div>                        <div class="visualClear"></div>
              </div>
    </div>
    <div id="mw-navigation">
      <h2>Navigation menu</h2>

      <div id="mw-head">
                  <div id="p-personal" role="navigation" class="" aria-labelledby="p-personal-label">
            <h3 id="p-personal-label">Personal tools</h3>
            <ul>
              <li id="pt-createaccount"><a href="/w/index.php?title=Special:UserLogin&amp;returnto=Non-breaking+space&amp;type=signup" title="You are encouraged to create an account and log in; however, it is not mandatory">Create account</a></li><li id="pt-login"><a href="/w/index.php?title=Special:UserLogin&amp;returnto=Non-breaking+space" title="You're encouraged to log in; however, it's not mandatory. [o]" accesskey="o">Log in</a></li>           </ul>
          </div>
                  <div id="left-navigation">
                    <div id="p-namespaces" role="navigation" class="vectorTabs" aria-labelledby="p-namespaces-label">
            <h3 id="p-namespaces-label">Namespaces</h3>
            <ul>
                              <li  id="ca-nstab-main" class="selected"><span><a href="/wiki/Non-breaking_space"  title="View the content page [c]" accesskey="c">Article</a></span></li>
                              <li  id="ca-talk"><span><a href="/wiki/Talk:Non-breaking_space"  title="Discussion about the content page [t]" accesskey="t">Talk</a></span></li>
                          </ul>
          </div>
                    <div id="p-variants" role="navigation" class="vectorMenu emptyPortlet" aria-labelledby="p-variants-label">
                        <h3 id="p-variants-label"><span>Variants</span><a href="#"></a></h3>

            <div class="menu">
              <ul>
                              </ul>
            </div>
          </div>
                  </div>
        <div id="right-navigation">
                    <div id="p-views" role="navigation" class="vectorTabs" aria-labelledby="p-views-label">
            <h3 id="p-views-label">Views</h3>
            <ul>
                              <li id="ca-view" class="selected"><span><a href="/wiki/Non-breaking_space" >Read</a></span></li>
                              <li id="ca-edit"><span><a href="/w/index.php?title=Non-breaking_space&amp;action=edit"  title="You can edit this page. Please use the preview button before saving [e]" accesskey="e">Edit</a></span></li>
                              <li id="ca-history" class="collapsible"><span><a href="/w/index.php?title=Non-breaking_space&amp;action=history"  title="Past versions of this page [h]" accesskey="h">View history</a></span></li>
                          </ul>
          </div>
                    <div id="p-cactions" role="navigation" class="vectorMenu emptyPortlet" aria-labelledby="p-cactions-label">
            <h3 id="p-cactions-label"><span>More</span><a href="#"></a></h3>

            <div class="menu">
              <ul>
                              </ul>
            </div>
          </div>
                    <div id="p-search" role="search">
            <h3>
              <label for="searchInput">Search</label>
            </h3>

            <form action="/w/index.php" id="searchform">
                            <div id="simpleSearch">
                              <input type="search" name="search" placeholder="Search" title="Search Wikipedia [f]" accesskey="f" id="searchInput" /><input type="hidden" value="Special:Search" name="title" /><input type="submit" name="fulltext" value="Search" title="Search Wikipedia for this text" id="mw-searchButton" class="searchButton mw-fallbackSearchButton" /><input type="submit" name="go" value="Go" title="Go to a page with this exact name if one exists" id="searchButton" class="searchButton" />               </div>
            </form>
          </div>
                  </div>
      </div>
      <div id="mw-panel">
        <div id="p-logo" role="banner"><a class="mw-wiki-logo" href="/wiki/Main_Page"  title="Visit the main page"></a></div>
            <div class="portal" role="navigation" id='p-navigation' aria-labelledby='p-navigation-label'>
      <h3 id='p-navigation-label'>Navigation</h3>

      <div class="body">
                  <ul>
                          <li id="n-mainpage-description"><a href="/wiki/Main_Page" title="Visit the main page [z]" accesskey="z">Main page</a></li>
                          <li id="n-contents"><a href="/wiki/Portal:Contents" title="Guides to browsing Wikipedia">Contents</a></li>
                          <li id="n-featuredcontent"><a href="/wiki/Portal:Featured_content" title="Featured content – the best of Wikipedia">Featured content</a></li>
                          <li id="n-currentevents"><a href="/wiki/Portal:Current_events" title="Find background information on current events">Current events</a></li>
                          <li id="n-randompage"><a href="/wiki/Special:Random" title="Load a random article [x]" accesskey="x">Random article</a></li>
                          <li id="n-sitesupport"><a href="https://donate.wikimedia.org/wiki/Special:FundraiserRedirector?utm_source=donate&amp;utm_medium=sidebar&amp;utm_campaign=C13_en.wikipedia.org&amp;uselang=en" title="Support us">Donate to Wikipedia</a></li>
                          <li id="n-shoplink"><a href="//shop.wikimedia.org" title="Visit the Wikimedia Shop">Wikipedia store</a></li>
                      </ul>
              </div>
    </div>
      <div class="portal" role="navigation" id='p-interaction' aria-labelledby='p-interaction-label'>
      <h3 id='p-interaction-label'>Interaction</h3>

      <div class="body">
                  <ul>
                          <li id="n-help"><a href="/wiki/Help:Contents" title="Guidance on how to use and edit Wikipedia">Help</a></li>
                          <li id="n-aboutsite"><a href="/wiki/Wikipedia:About" title="Find out about Wikipedia">About Wikipedia</a></li>
                          <li id="n-portal"><a href="/wiki/Wikipedia:Community_portal" title="About the project, what you can do, where to find things">Community portal</a></li>
                          <li id="n-recentchanges"><a href="/wiki/Special:RecentChanges" title="A list of recent changes in the wiki [r]" accesskey="r">Recent changes</a></li>
                          <li id="n-contactpage"><a href="//en.wikipedia.org/wiki/Wikipedia:Contact_us">Contact page</a></li>
                      </ul>
              </div>
    </div>
      <div class="portal" role="navigation" id='p-tb' aria-labelledby='p-tb-label'>
      <h3 id='p-tb-label'>Tools</h3>

      <div class="body">
                  <ul>
                          <li id="t-whatlinkshere"><a href="/wiki/Special:WhatLinksHere/Non-breaking_space" title="List of all English Wikipedia pages containing links to this page [j]" accesskey="j">What links here</a></li>
                          <li id="t-recentchangeslinked"><a href="/wiki/Special:RecentChangesLinked/Non-breaking_space" title="Recent changes in pages linked from this page [k]" accesskey="k">Related changes</a></li>
                          <li id="t-upload"><a href="/wiki/Wikipedia:File_Upload_Wizard" title="Upload files [u]" accesskey="u">Upload file</a></li>
                          <li id="t-specialpages"><a href="/wiki/Special:SpecialPages" title="A list of all special pages [q]" accesskey="q">Special pages</a></li>
                          <li id="t-permalink"><a href="/w/index.php?title=Non-breaking_space&amp;oldid=665330371" title="Permanent link to this revision of the page">Permanent link</a></li>
                          <li id="t-info"><a href="/w/index.php?title=Non-breaking_space&amp;action=info" title="More information about this page">Page information</a></li>
                          <li id="t-wikibase"><a href="//www.wikidata.org/wiki/Q1053612" title="Link to connected data repository item [g]" accesskey="g">Wikidata item</a></li>
            <li id="t-cite"><a href="/w/index.php?title=Special:CiteThisPage&amp;page=Non-breaking_space&amp;id=665330371" title="Information on how to cite this page">Cite this page</a></li>         </ul>
              </div>
    </div>
      <div class="portal" role="navigation" id='p-coll-print_export' aria-labelledby='p-coll-print_export-label'>
      <h3 id='p-coll-print_export-label'>Print/export</h3>

      <div class="body">
                  <ul>
                          <li id="coll-create_a_book"><a href="/w/index.php?title=Special:Book&amp;bookcmd=book_creator&amp;referer=Non-breaking+space">Create a book</a></li>
                          <li id="coll-download-as-rdf2latex"><a href="/w/index.php?title=Special:Book&amp;bookcmd=render_article&amp;arttitle=Non-breaking+space&amp;oldid=665330371&amp;writer=rdf2latex">Download as PDF</a></li>
                          <li id="t-print"><a href="/w/index.php?title=Non-breaking_space&amp;printable=yes" title="Printable version of this page [p]" accesskey="p">Printable version</a></li>
                      </ul>
              </div>
    </div>
      <div class="portal" role="navigation" id='p-lang' aria-labelledby='p-lang-label'>
      <h3 id='p-lang-label'>Languages</h3>

      <div class="body">
                  <ul>
                          <li class="interlanguage-link interwiki-cs"><a href="//cs.wikipedia.org/wiki/Nezlomiteln%C3%A1_mezera" title="Nezlomitelná mezera – Czech" lang="cs" hreflang="cs">Čeština</a></li>
                          <li class="interlanguage-link interwiki-de"><a href="//de.wikipedia.org/wiki/Gesch%C3%BCtztes_Leerzeichen" title="Geschütztes Leerzeichen – German" lang="de" hreflang="de">Deutsch</a></li>
                          <li class="interlanguage-link interwiki-es"><a href="//es.wikipedia.org/wiki/Espacio_duro" title="Espacio duro – Spanish" lang="es" hreflang="es">Español</a></li>
                          <li class="interlanguage-link interwiki-fa"><a href="//fa.wikipedia.org/wiki/%D9%81%D8%A7%D8%B5%D9%84%D9%87_%D9%86%D8%B4%DA%A9%D9%86" title="فاصله نشکن – Persian" lang="fa" hreflang="fa">فارسی</a></li>
                          <li class="interlanguage-link interwiki-fr"><a href="//fr.wikipedia.org/wiki/Espace_ins%C3%A9cable" title="Espace insécable – French" lang="fr" hreflang="fr">Français</a></li>
                          <li class="interlanguage-link interwiki-ko"><a href="//ko.wikipedia.org/wiki/%EC%A4%84_%EB%B0%94%EA%BF%88_%EC%97%86%EB%8A%94_%EA%B3%B5%EB%B0%B1" title="줄 바꿈 없는 공백 – Korean" lang="ko" hreflang="ko">한국어</a></li>
                          <li class="interlanguage-link interwiki-it"><a href="//it.wikipedia.org/wiki/Spazio_unificatore" title="Spazio unificatore – Italian" lang="it" hreflang="it">Italiano</a></li>
                          <li class="interlanguage-link interwiki-nl"><a href="//nl.wikipedia.org/wiki/Spatie#Harde_spatie" title="Spatie – Dutch" lang="nl" hreflang="nl">Nederlands</a></li>
                          <li class="interlanguage-link interwiki-ja"><a href="//ja.wikipedia.org/wiki/%E3%83%8E%E3%83%BC%E3%83%96%E3%83%AC%E3%83%BC%E3%82%AF%E3%82%B9%E3%83%9A%E3%83%BC%E3%82%B9" title="ノーブレークスペース – Japanese" lang="ja" hreflang="ja">日本語</a></li>
                          <li class="interlanguage-link interwiki-no"><a href="//no.wikipedia.org/wiki/Hardt_mellomrom" title="Hardt mellomrom – Norwegian" lang="no" hreflang="no">Norsk bokmål</a></li>
                          <li class="interlanguage-link interwiki-nn"><a href="//nn.wikipedia.org/wiki/Hardt_mellomrom" title="Hardt mellomrom – Norwegian Nynorsk" lang="nn" hreflang="nn">Norsk nynorsk</a></li>
                          <li class="interlanguage-link interwiki-pl"><a href="//pl.wikipedia.org/wiki/Spacja_nie%C5%82ami%C4%85ca" title="Spacja niełamiąca – Polish" lang="pl" hreflang="pl">Polski</a></li>
                          <li class="interlanguage-link interwiki-pt"><a href="//pt.wikipedia.org/wiki/Espa%C3%A7o_r%C3%ADgido" title="Espaço rígido – Portuguese" lang="pt" hreflang="pt">Português</a></li>
                          <li class="interlanguage-link interwiki-ru"><a href="//ru.wikipedia.org/wiki/%D0%9D%D0%B5%D1%80%D0%B0%D0%B7%D1%80%D1%8B%D0%B2%D0%BD%D1%8B%D0%B9_%D0%BF%D1%80%D0%BE%D0%B1%D0%B5%D0%BB" title="Неразрывный пробел – Russian" lang="ru" hreflang="ru">Русский</a></li>
                          <li class="interlanguage-link interwiki-fi"><a href="//fi.wikipedia.org/wiki/Sitova_v%C3%A4lily%C3%B6nti" title="Sitova välilyönti – Finnish" lang="fi" hreflang="fi">Suomi</a></li>
                          <li class="interlanguage-link interwiki-sv"><a href="//sv.wikipedia.org/wiki/H%C3%A5rt_mellanslag" title="Hårt mellanslag – Swedish" lang="sv" hreflang="sv">Svenska</a></li>
                          <li class="interlanguage-link interwiki-zh"><a href="//zh.wikipedia.org/wiki/%E4%B8%8D%E6%8D%A2%E8%A1%8C%E7%A9%BA%E6%A0%BC" title="不换行空格 – Chinese" lang="zh" hreflang="zh">中文</a></li>
                          <li class="uls-p-lang-dummy"><a href="#"></a></li>
                      </ul>
        <div class='after-portlet after-portlet-lang'><span class="wb-langlinks-edit wb-langlinks-link"><a href="//www.wikidata.org/wiki/Q1053612#sitelinks-wikipedia" title="Edit interlanguage links" class="wbc-editpage">Edit links</a></span></div>      </div>
    </div>
        </div>
    </div>
    <div id="footer" role="contentinfo">
              <ul id="footer-info">
                      <li id="footer-info-lastmod"> This page was last modified on 3 June 2015, at 14:28.</li>
                      <li id="footer-info-copyright">Text is available under the <a rel="license" href="//en.wikipedia.org/wiki/Wikipedia:Text_of_Creative_Commons_Attribution-ShareAlike_3.0_Unported_License">Creative Commons Attribution-ShareAlike License</a><a rel="license" href="//creativecommons.org/licenses/by-sa/3.0/" style="display:none;"></a>;
additional terms may apply.  By using this site, you agree to the <a href="//wikimediafoundation.org/wiki/Terms_of_Use">Terms of Use</a> and <a href="//wikimediafoundation.org/wiki/Privacy_policy">Privacy Policy</a>. Wikipedia® is a registered trademark of the <a href="//www.wikimediafoundation.org/">Wikimedia Foundation, Inc.</a>, a non-profit organization.</li>
                  </ul>
              <ul id="footer-places">
                      <li id="footer-places-privacy"><a href="//wikimediafoundation.org/wiki/Privacy_policy" title="wikimedia:Privacy policy">Privacy policy</a></li>
                      <li id="footer-places-about"><a href="/wiki/Wikipedia:About" title="Wikipedia:About">About Wikipedia</a></li>
                      <li id="footer-places-disclaimer"><a href="/wiki/Wikipedia:General_disclaimer" title="Wikipedia:General disclaimer">Disclaimers</a></li>
                      <li id="footer-places-contact"><a href="//en.wikipedia.org/wiki/Wikipedia:Contact_us">Contact Wikipedia</a></li>
                      <li id="footer-places-developers"><a href="https://www.mediawiki.org/wiki/Special:MyLanguage/How_to_contribute">Developers</a></li>
                      <li id="footer-places-mobileview"><a href="//en.m.wikipedia.org/w/index.php?title=Non-breaking_space&amp;mobileaction=toggle_view_mobile" class="noprint stopMobileRedirectToggle">Mobile view</a></li>
                  </ul>
                    <ul id="footer-icons" class="noprint">
                      <li id="footer-copyrightico">
                              <a href="//wikimediafoundation.org/"><img src="/static/images/wikimedia-button.png" srcset="/static/images/wikimedia-button-1.5x.png 1.5x, /static/images/wikimedia-button-2x.png 2x" width="88" height="31" alt="Wikimedia Foundation"/></a>
                          </li>
                      <li id="footer-poweredbyico">
                              <a href="//www.mediawiki.org/"><img src="//en.wikipedia.org/static/1.26wmf7/resources/assets/poweredby_mediawiki_88x31.png" alt="Powered by MediaWiki" srcset="//en.wikipedia.org/static/1.26wmf7/resources/assets/poweredby_mediawiki_132x47.png 1.5x, //en.wikipedia.org/static/1.26wmf7/resources/assets/poweredby_mediawiki_176x62.png 2x" width="88" height="31" /></a>
                          </li>
                  </ul>
            <div style="clear:both"></div>
    </div>
    <script>if(window.jQuery)jQuery.ready();</script><script>if(window.mw){
mw.loader.state({"ext.globalCssJs.site":"ready","ext.globalCssJs.user":"ready","site":"loading","user":"ready","user.groups":"ready"});
}</script>
<script>if(window.mw){
mw.loader.load(["mediawiki.toc","ext.cite","mediawiki.action.view.postEdit","mediawiki.user","mediawiki.hidpi","mediawiki.page.ready","mediawiki.searchSuggest","ext.cirrusSearch.loggingSchema","ext.imageMetrics.loader","ext.visualEditor.targetLoader","ext.eventLogging.subscriber","ext.wikimediaEvents.statsd","ext.navigationTiming","schema.UniversalLanguageSelector","ext.uls.eventlogger","ext.uls.interlanguage","ext.gadget.teahouse","ext.gadget.ReferenceTooltips","ext.gadget.DRN-wizard","ext.gadget.charinsert","ext.gadget.refToolbar","ext.gadget.switcher","ext.gadget.featured-articles-links"],null,true);
}</script>
<script>if(window.mw){
document.write("\u003Cscript src="//en.wikipedia.org/w/load.php?debug=false\u0026amp;lang=en\u0026amp;modules=site\u0026amp;only=scripts\u0026amp;skin=vector\u0026amp;*"\u003E\u003C/script\u003E");
}</script>
<script>if(window.mw){
mw.config.set({"wgBackendResponseTime":110,"wgHostname":"mw1045"});
}</script>
  </body>
</html>
`;
