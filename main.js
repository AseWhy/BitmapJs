const inputs = document.getElementsByTagName("input"),
      logger = document.getElementById("logger"),
      doned = document.getElementById("doned"),
      files = inputs[0],
      cnavs = document.createElement("canvas"),
      ctx = cnavs.getContext("2d"),
      on_cut = document.getElementById("on_cut"),
      on_post = document.getElementById("on_post"),
      download = document.getElementById("download"),
      download_s = document.getElementsByClassName("download_s");

var is_read = false,
    cancel_frame = false,
    transparent_bg = false,
    is_cancel = false,
    read_img = 0,
    buffer = [],
    color_buffer = {},
    W_FILL_COLOR = inputs[7].value,
    map = {
        width: 0,
        height: 0
    };

function getMax(){
    var ret = {
        summ: 0
    };
    for(var cur in color_buffer){
        if(ret.summ < color_buffer[cur].summ)
            ret = color_buffer[cur];
    }
    inputs[8].value = ret.hex;
    return ret;
}

function Update(){
    if(read_img > 0){
        is_cancel = true;
    }else{
        files.oninput();
    }
}

//Settings
const W_BORDER = 255*3,
      W_OPACITY = 0;

inputs[5].oninput = Update;

inputs[6].oninput = function(){
    if(inputs[6].checked){
        inputs[10].disabled = true;
    }else{
        inputs[10].disabled = false;
    }
    Update()
};

inputs[7].oninput = Update;

inputs[8].oninput = function(){
    cancel_frame = inputs[8].checked;
    Update()
}
inputs[9].oninput = function(){
    transparent_bg = inputs[9].checked;
    Update()
}
inputs[10].oninput = function(){
    W_FILL_COLOR = inputs[10].value;
    Update();
}

inputs[2].oninput = inputs[3].oninput = function(){
    if(files.files.length > 0){
        map.width = parseInt(inputs[2].value);
        map.height = parseInt(inputs[3].value);

        if(isNaN(map.width) || isNaN(map.height) || map.height < 1 || map.width < 1){
            logger.innerText = "Ошибка, введены неправильные значения";
        } else {
            logger.innerText = "";
            Update();
        }
    }else{
        map.width = parseInt(inputs[2].value);
        map.height = parseInt(inputs[3].value);

        if(isNaN(map.width) || isNaN(map.height) || map.height < 1 || map.width < 1){
            logger.innerText = "Ошибка, введены неправильные значения";
        }else{
            logger.innerText = "";
            Update();
        }
    }
}

inputs[4].oninput = function(){
    if(inputs[4].checked){
        on_post.style.height = "auto";
    }else{
        on_post.style.height = "0px";
    }
    Update();
}

inputs[1].oninput = function(){
    if(inputs[1].checked){
        on_cut.style.height = "auto";
    }else{
        on_cut.style.height = "0px";
    }
    Update();
}

download_s[0].onclick = download_s[1].onclick = function(e){
    var a  = document.createElement('a');
    a.download = 'image.';
    if(e.target.getAttribute("vol") === "png"){
        a.href = cnavs.toDataURL();
        a.download += "png";
    }else{
        a.href = cnavs.toDataURL('image/jpeg', 0.95);
        a.download += "jpg";
    }
    a.click();
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

/**
 *
 * Processes an image, receives pixel data
 *
 *
 * @param {String} url - base64 string that contains the local image for further manipulations
 * @return {ImageData} imageData
 */
function getBimap(url){
    return new Promise(function(enj, rdj){
        var img = document.createElement("img");
        img.src = url;
        img.onload = function(){
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);
            enj(context.getImageData(0, 0, img.width, img.height));
        }
    });
}

/**
 *
 * Processes the image by cropping extra pixels
 *
 *
 * @param {ImageData} img_buffer - Incoming imageData
 * @param {Object} border - the color border of the pixel at which it is considered empty
 * @param {Number} opacity - color border opacity at which the pixel is considered empty
 * @return {ImageData} Cropping data, height width, start x and y
 */
function dec_img(img_buffer, border, opacity){
    var max_x = 0,
        max_y = 0,
        min_y = img_buffer.height,
        min_x = img_buffer.width,
        x,
        y;
        sum = 0,
        ly = 0;
    
    for(var i = 0;i < img_buffer.data.length;i += 4){
        y = Math.floor((i / 4) / img_buffer.width);
        x = (i / 4) - (y * img_buffer.width);

        sum = (img_buffer.data[i]+img_buffer.data[i+1]+img_buffer.data[i+2]);

        if(img_buffer.data[i+3] === opacity || sum === border)
            continue;

            if(min_x > x)
                min_x = x;
            if(min_y > y)
                min_y = y;
            if(max_x < x)
                max_x = x;
            if(max_y < y)
                max_y = y;
    }

    return {
        min: {
            x: min_x,
            y: min_y
        },
        rect: {
            w: max_x - min_x,
            h: max_y - min_y
        }
    }
}

/**
 * Crop image
 * 
 * @param {ImageData} data - imageData
 * @param {Number} dx - The beginning of the cropped image by x
 * @param {Number} dy - The beginning of the cropped image by y
 * @param {Number} w - Cropped Image Width
 * @param {Number} h - Cropped Image Height
 * @return {ImageData} new ImageData
 */
function cut(data, dx, dy, w, h){
    try{
        var new_data = ctx.createImageData(w, h),
                                                y,
                                                x,
                                        lb = dy + h,
                                        lr = dx + w,
                                                pos,
                                                mx,
                                                my,
                                            mpos;

        for (var y = dy; y < lb; y++)
            for (var x = dx; x < lr; x++) {
                mx = x - dx;
                my = y - dy;
                pos = 4 * (y * data.width + x);
                mpos = 4 * (my * w + mx);

                new_data.data[mpos] = data.data[pos]
                new_data.data[mpos+1] = data.data[pos+1]
                new_data.data[mpos+2] = data.data[pos+2]
                new_data.data[mpos+3] = data.data[pos+3]
            }
        
        return new_data;
    } catch (ex){
        logger.innerText = "Произошла ошибка, перезагрузите страницу."
    }
}

/**
 * Separates image on chuncks
 * 
 * @param {ImageData} data - imageData
 * @param {Number} dx - chuncks per x
 * @param {Number} dy - chuncks per y
 * @return {Array} array image data
 */
function Separate(d, dx, dy){
    var ret = [],
    cw = d.width / dx,
    ch = d.height / dy,
                cuted_x,
                cuted_y;

    for(var x = 0;x < dx;x++)
        for(var y = 0;y < dy;y++){
            ret.push(cut(d, Math.round(x * cw), Math.round(y * ch), Math.round(cw), Math.round(ch)));
        }
    return ret;
}

function getDominantColor(d){
    var colors = [];
    var col;
    for(var i = 0;i < d.data.length;i += 4){
        col = d.data[i]+d.data[i+1]+d.data[i+2];
        if(colors[col] != undefined)
            colors[col].useless++;
        else
            colors[col] = {
                useless: 0,
                color: col,
                color_rgb: {
                    r: d.data[i],
                    g: d.data[i+1],
                    b: d.data[i+2]
                }
            }
    }

    colors.sort(function(a, b){
        return b.useless - a.useless;
    });

    return colors[0];
}


/**
 * Draw image async
 * @param {ImageData} imagedata 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Number} x 
 * @param {Number} w 
 * @param {Number} h 
 */
function draw_imagedata(imagedata, ctx, x, w, h) {
    var canvas = document.createElement('canvas');
    var ctxx = canvas.getContext('2d');
    canvas.width = imagedata.width;
    canvas.height = imagedata.height;
    ctxx.putImageData(imagedata, 0, 0);

    ctx.drawImage(canvas, x, 0, w, h)
}

function loadDone(){
    var width = 0,
        height = 0,
        max_w = 0,
        min_w = Infinity,
        min_h = Infinity,
        max_h = 0;

    for(var i = 0;i < buffer.length;i++){
        if(buffer[i].height > height){
            height = buffer[i].height;
            max_h = buffer[i].height;
        }
        if(buffer[i].width > max_w){
            max_w = buffer[i].width;
        }
    }

    cnavs.width = max_w * buffer.length;
    cnavs.height = height;

    if(cancel_frame){
        for(var i = 0;i < buffer.length;i++){
            if(buffer[i].height < min_h){
                height = buffer[i].height;
                min_h = buffer[i].height;
            }

            if(buffer[i].width < min_h){
                min_w = buffer[i].width;
            }
        }
        
        cnavs.width = min_w * buffer.length;
        cnavs.height = height;
    }

    if(!transparent_bg){
        ctx.fillStyle = inputs[6].checked ? getMax().hex : W_FILL_COLOR;
        ctx.fillRect(0, 0, cnavs.width,cnavs.height);
    }

    for(var i = 0;i < buffer.length;i++)
        if(!cancel_frame)
            ctx.putImageData(
                buffer[i],
                max_w * i,
                0);
        else
            draw_imagedata(buffer[i], ctx, min_w * i, min_w, min_h)
    
    doned.src = cnavs.toDataURL();
    doned.style.height = cnavs.height + "px";
    doned.style.width = cnavs.width + "px";
    doned.style.opacity = 1;
}

files.oninput = function(){
    download.style.display = "none";
    var start = Date.now(),
        fls = files.files,
        reader  = new FileReader();
    
    var data = null;
    var cut_i = null;
    var v_color = null;
    var col = null;
    var hex = null;

    reader.onloadend = function () {
        getBimap(reader.result).then(function(e){
            if(inputs[5].checked){
                col = getDominantColor(e);
                v_color = col.color;
                hex = rgbToHex(col.color_rgb.r, col.color_rgb.g, col.color_rgb.b);

                if(!color_buffer[hex]){
                    color_buffer[hex] = {
                        summ: 0,
                        hex: hex
                    }
                }else{
                    color_buffer[hex].summ++;
                }

            }else{
                v_color = W_BORDER;
            }
            if(inputs[1].checked && (!isNaN(map.width) && !isNaN(map.height))){
                e = Separate(e, map.width, map.height);
                for(var i = 0;i < e.length;i++){
                    if(inputs[7].checked){
                        data = dec_img(e[i], v_color, W_OPACITY);
                        cut_i = cut(e[i], data.min.x, data.min.y, data.rect.w, data.rect.h);
                        buffer.push(cut_i);
                    }else{
                        buffer.push(e[i]);
                    }
                }
            } else {
                if(inputs[7].checked){
                    data = dec_img(e, v_color, W_OPACITY);
                    cut_i = cut(e, data.min.x, data.min.y, data.rect.w, data.rect.h);
                    buffer.push(cut_i);
                }else{
                    buffer.push(e);
                }
            }

            read_img++;
            is_read = false;
        })
    }

    function try_read(){
        if(read_img >= fls.length){
            if(!is_cancel){
                loadDone();
                buffer = [];
                read_img = 0;
                logger.innerText = "done: " + (Date.now() - start) + "(ms)";
                download.style.display = "grid";
            }else{
                read_img = 0;
                buffer = [];
                is_cancel = false;
                files.oninput();
            }
            return;
        } else {
            requestAnimationFrame(try_read);
        }

        if(!is_read){
            logger.innerText = "dec " + fls[read_img].name;

            reader.readAsDataURL(fls[read_img]);
            is_read = true;
        }
    }
    try_read();
}
