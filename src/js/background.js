/**
 * Manages the fetching and display of the background media (image or video)
 * from a GitHub Pages repository.
 */
const BackgroundManager = {

    fetchRandom() {
        const repoUrl = 'https://harsh-bin.github.io/wallpaper-api';
        const bgImage = document.getElementById("randomBackground");
        const bgVideo = document.getElementById("randomBackgroundVideo");

        bgImage.classList.remove("active");
        bgVideo.classList.remove("active");

        // Fetch the list of media from the JSON file
        fetch(`${repoUrl}/random_media_list.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load resource: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {

                const mediaFiles = data.media; 
                if (!mediaFiles || mediaFiles.length === 0) {
                    throw new Error("Media list is empty or invalid.");
                }

                const randomIndex = Math.floor(Math.random() * mediaFiles.length);
                const randomMediaFile = mediaFiles[randomIndex];
                const mediaUrl = `${repoUrl}/${randomMediaFile}`;

                // Check file extension to determine if it's a video or image
                if (randomMediaFile.endsWith('.mp4') || randomMediaFile.endsWith('.webm')) {
                    // It's a video
                    bgImage.style.display = 'none'; 
                    bgVideo.style.display = 'block'; 
                    bgVideo.src = mediaUrl;
                    bgVideo.onloadeddata = () => {
                        bgVideo.play().catch(e => console.error("Autoplay was prevented:", e));
                        bgVideo.classList.add("active");
                    };
                    bgVideo.onerror = () => {
                        console.error("Failed to load selected video:", mediaUrl);
                        this.setFallbackBackground();
                    };
                } else {
                    // It's an image
                    bgVideo.style.display = 'none'; 
                    bgImage.style.display = 'block'; 
                    bgImage.src = mediaUrl;
                    bgImage.onload = () => bgImage.classList.add("active");
                    bgImage.onerror = () => {
                        console.error("Failed to load selected image:", mediaUrl);
                        this.setFallbackBackground();
                    };
                }
            })
            .catch(error => {
                console.error("Failed to fetch or process media list:", error);
                this.setFallbackBackground();
            });
    },

    /**
     * Sets a fallback background image in case of an error.
     */
    setFallbackBackground() {
        const bgImage = document.getElementById("randomBackground");
        const bgVideo = document.getElementById("randomBackgroundVideo");

        bgVideo.style.display = 'none';
        bgVideo.pause();
        bgVideo.src = '';

        bgImage.style.display = 'block';
        bgImage.src = "https://picsum.photos/1920/1080";
        bgImage.onload = () => bgImage.classList.add("active");
    }
};

/*
/**
 *
 * Manages the fetching and display of the background image.
 *  
 * This version fetches media from a local server and handles both images and videos.
 * delet the above code if you want to use this one including this line and also the closing star and slash at last line of code.
const BackgroundManager = {
    _currentObjectURL: null,

    _cleanupURL() {
        if (this._currentObjectURL) {
            URL.revokeObjectURL(this._currentObjectURL);
            this._currentObjectURL = null;
        }
    },

    fetchRandom() {
        const bgImage = document.getElementById("randomBackground");
        const bgVideo = document.getElementById("randomBackgroundVideo");
        const timestamp = new Date().getTime();
        const mediaUrl = `http://localhost:4000/random-media?t=${timestamp}`;

        bgImage.classList.remove("active");
        bgVideo.classList.remove("active");

        fetch(mediaUrl)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const contentType = response.headers.get("content-type");
                if (!contentType) throw new Error("No content-type header found");
                return response.blob().then(blob => ({ blob, contentType }));
            })
            .then(({ blob, contentType }) => {
                this._cleanupURL();
                const objectURL = URL.createObjectURL(blob);
                this._currentObjectURL = objectURL;

                if (contentType.startsWith('image/')) {
                    bgVideo.style.display = 'none';
                    bgImage.style.display = 'block';
                    bgImage.src = objectURL;
                    bgImage.onload = () => bgImage.classList.add("active");
                } else if (contentType.startsWith('video/')) {
                    bgImage.style.display = 'none';
                    bgVideo.style.display = 'block';
                    bgVideo.src = objectURL;
                    bgVideo.onloadeddata = () => {
                        bgVideo.play().catch(e => console.error("Autoplay was prevented:", e));
                        bgVideo.classList.add("active");
                    };
                } else {
                    console.warn(`Unsupported content type: ${contentType}. Using fallback.`);
                    this.setFallbackBackground();
                }
            })
            .catch(error => {
                console.error("Failed to load background media from local server:", error);
                this.setFallbackBackground();
            });
    },

    setFallbackBackground() {
        this._cleanupURL();
        const bgImage = document.getElementById("randomBackground");
        const bgVideo = document.getElementById("randomBackgroundVideo");

        bgVideo.style.display = 'none';
        bgVideo.pause();
        bgVideo.src = '';
        
        bgImage.style.display = 'block';
        bgImage.src = "https://picsum.photos/1920/1080";
        bgImage.onload = () => bgImage.classList.add("active");
    }
};
*/