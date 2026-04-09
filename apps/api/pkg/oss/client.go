package oss

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"fluxfiles/api/internal/config"

	ossv2 "github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
)

type Client struct {
	client    *ossv2.Client
	bucket    string
	signedTTL time.Duration
}

type PresignedUpload struct {
	URL           string
	Method        string
	Expiration    time.Time
	SignedHeaders map[string]string
}

type HeadObjectResult = ossv2.HeadObjectResult

func New(cfg config.StorageConfig) (*Client, error) {
	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	ossConfig := ossv2.LoadDefaultConfig().
		WithRegion(cfg.Region).
		WithEndpoint(cfg.Endpoint).
		WithHttpClient(httpClient).
		WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.AccessKeySecret))

	client := ossv2.NewClient(ossConfig)
	return &Client{
		client:    client,
		bucket:    cfg.Bucket,
		signedTTL: time.Duration(cfg.SignedURLTTLMinutes) * time.Minute,
	}, nil
}

func (c *Client) PresignDownload(ctx context.Context, objectKey, downloadName string) (string, time.Time, error) {
	download, err := c.client.Presign(ctx, &ossv2.GetObjectRequest{
		Bucket:                     ossv2.Ptr(c.bucket),
		Key:                        ossv2.Ptr(objectKey),
		ResponseContentDisposition: ossv2.Ptr(buildAttachmentDisposition(downloadName)),
	}, ossv2.PresignExpires(c.signedTTL))
	if err != nil {
		return "", time.Time{}, err
	}

	return download.URL, download.Expiration, nil
}

func buildAttachmentDisposition(fileName string) string {
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		fileName = "download"
	}

	ascii := strings.NewReplacer("\\", "_", "\"", "_", ";", "_", "\r", "", "\n", "").Replace(fileName)
	if ascii == "" {
		ascii = "download"
	}

	return "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + url.QueryEscape(fileName)
}

func (c *Client) PresignUpload(ctx context.Context, objectKey, contentType string) (*PresignedUpload, error) {
	result, err := c.client.Presign(ctx, &ossv2.PutObjectRequest{
		Bucket:      ossv2.Ptr(c.bucket),
		Key:         ossv2.Ptr(objectKey),
		ContentType: ossv2.Ptr(contentType),
	}, ossv2.PresignExpires(c.signedTTL))
	if err != nil {
		return nil, err
	}

	return &PresignedUpload{
		URL:           result.URL,
		Method:        result.Method,
		Expiration:    result.Expiration,
		SignedHeaders: result.SignedHeaders,
	}, nil
}

func (c *Client) HeadObject(ctx context.Context, objectKey string) (*ossv2.HeadObjectResult, error) {
	return c.client.HeadObject(ctx, &ossv2.HeadObjectRequest{
		Bucket: ossv2.Ptr(c.bucket),
		Key:    ossv2.Ptr(objectKey),
	})
}

func (c *Client) Delete(ctx context.Context, objectKey string) error {
	_, err := c.client.DeleteObject(ctx, &ossv2.DeleteObjectRequest{
		Bucket: ossv2.Ptr(c.bucket),
		Key:    ossv2.Ptr(objectKey),
	})
	return err
}
